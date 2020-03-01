import Yaml from "js-yaml";
import {
    Cluster,
    RegionsConfig,
    SubnetRoutes,
    AssertValidRoute,
} from "./planner";
import drawTree from "./tree_view";
import drawDiagram from "./diagram_view";
import drawJSON from "./json_view";
import drawPulumi from "./pulumi_view";
import drawTerraform from "./terraform_view";

class Ok<T> {
    value: T;
    constructor(value: T) {
        this.value = value;
    }
}

class Err<E> {
    err: E;
    constructor(e: E) {
        this.err = e;
    }
}

type Result<T, E> = Ok<T> | Err<E>;
const ok = <T, E>(value: T): Result<T, E> => new Ok(value)
const err = <T, E>(error: E): Result<T, E> => new Err(error)


interface PlanConfig {
    provider: string;
    cidr: string;
    regions: RegionsConfig;
    subnet_routes: SubnetRoutes;
}

let planClearCallbacks: (() => void)[] = [];

function resetPlanInteractions(): void {
    for (const cb of planClearCallbacks) {
        cb();
    }
}

function loadConfig(cfgStr: string): Result<PlanConfig, string> {
    const cfg = Yaml.safeLoad(cfgStr);

    if (!cfg.provider) {
        // default to aws as provider
        cfg.provider = "aws";
    } else {
        switch (cfg.provider) {
            case "aws": {
                break;
            }
            default: {
                return err(`${cfg.provider} is not a supported provider type, please submit a pull request at: <a href="https://github.com/houqp/vpcstudio">https://github.com/houqp/vpcstudio</a>`);
            }
        }
    }

    if (!cfg.cidr) {
        return err("Missing cidr key in config");
    }

    if (!cfg.regions) {
        return err("Missing regions key in config");
    }

    if (!cfg.subnet_routes) {
        return err("Missing subnet_routes key in config");
    }
    const subnet_names = Object.keys(cfg.subnet_routes);
    if (subnet_names.length === 1) {
        // if there is only one route, enforce size to be m since other size
        // doesn't make sense
        cfg.subnet_routes[subnet_names[0]].size = "m";
    } else {
        for (const subnet_name of subnet_names) {
            if (!cfg.subnet_routes[subnet_name].size) {
                // default to medium size if not specified
                cfg.subnet_routes[subnet_name].size = "m";
            }
        }
    }

    for (const region_name of Object.keys(cfg.regions)) {
        const region = cfg.regions[region_name];
        if (!region.region) {
            return err(`Missing region key for "${region_name}" section`);
        }
        if (!region.zone_count) {
            region.zone_count = 3;
        }
    }

    return ok(cfg);
}

function plan(cfgStr: string): string | null {
    resetPlanInteractions();
    planClearCallbacks = [];

    let cfg: PlanConfig;
    const re = loadConfig(cfgStr);
    if (re instanceof Err) {
        return re.err;
    } else {
        cfg = re.value;
    }

    const region_names = Object.keys(cfg.regions);
    const err_msg = AssertValidRoute(
        cfg.cidr,
        region_names.length,
        cfg.regions[region_names[0]].zone_count,
        cfg.subnet_routes,
    );
    if (err_msg != null) {
        return err_msg;
    }

    const cidr = cfg.cidr;
    const cluster = new Cluster(cfg.provider, cidr, cfg.regions, cfg.subnet_routes);

    drawDiagram(cluster, planClearCallbacks);
    drawTree(cluster);
    drawJSON(cluster);
    drawTerraform(cluster);
    drawPulumi(cluster);

    return null;
}

function setTabActive(target_tab: HTMLElement): void {
    resetPlanInteractions();

    const vis_section = document.getElementById("vis") as HTMLElement;
    const active_tab = vis_section.querySelector(".is-active");
    if (active_tab != null && active_tab !== target_tab) {
        active_tab.classList.remove("is-active");
    }
    target_tab.classList.add("is-active");

    // hide container for all visualization
    const vis_container = document.getElementById("vis") as HTMLElement;
    const vis_boxes = vis_container.querySelectorAll(".container .box");
    for (let i = 0; i < vis_boxes.length; i ++) {
        const box = vis_boxes[i] as HTMLElement;
        box.style.display = "none";
    }

    // show container for selected visualization
    const vis_box_id = target_tab.dataset.target as string;
    const box = document.getElementById(vis_box_id) as HTMLElement;
    box.style.display = "block";
}

function setupModalClose(modal: HTMLElement): void {
    const bg = modal.querySelector(".modal-background") as HTMLElement;
    const close = modal.querySelector(".modal-close") as HTMLElement;
    const closeModal = (): void => {
        modal.classList.remove("is-active");
    }
    bg.addEventListener("click", closeModal);
    close.addEventListener("click", closeModal);
}

function main(): void {
    const editor = ace.edit("config");
    editor.setTheme("ace/theme/tomorrow");
    editor.session.setMode("ace/mode/yaml");

    const sampleConfig = `provider: aws
cidr: "10.10.0.0/15"
# define number of VPCs and number of zones within each VPC
regions:
    "us1":
        region: "us-west-2"
        zone_count: 3
    "us2":
        region: "us-east-2"
        zone_count: 3
    "sa":
        region: "sa-east-1"
        zone_count: 3
    "eu":
        region: "eu-north-1"
        zone_count: 3
    "staging":
        region: "us-west-2"
        zone_count: 3
    "dev":
        region: "us-east-2"
        zone_count: 3
# define subnets within each zone
subnet_routes:
    # publically accessbile services like ALB
    public:
        size: s
    # internal services
    private_company:
        size: l
    # data store and message bus that should not have outbound internet access
    intra_infra:
        size: m
`
    editor.getSession().setValue(sampleConfig);

    const diagram_tab = document.getElementById("diagram-tab") as HTMLElement;
    const showDiagram = function(): void {
        setTabActive(diagram_tab);
    };
    diagram_tab.addEventListener("click", showDiagram);

    const tree_tab = document.getElementById("tree-tab") as HTMLElement;
    tree_tab.addEventListener("click", function(){ setTabActive(tree_tab) });

    const terraform_tab = document.getElementById("terraform-tab") as HTMLElement;
    terraform_tab.addEventListener("click", function(){ setTabActive(terraform_tab) });

    const pulumi_tab = document.getElementById("pulumi-tab") as HTMLElement;
    pulumi_tab.addEventListener("click", function(){ setTabActive(pulumi_tab) });

    const json_tab = document.getElementById("json-tab") as HTMLElement;
    json_tab.addEventListener("click", function(){ setTabActive(json_tab) });

    const overlay = document.getElementById("message-overlay") as HTMLElement;
    const planFromEditorValue = function(): void {
        const err_msg = plan(editor.getSession().getValue());
        if (err_msg !== null) {
            const b = overlay.querySelector(".box p") as HTMLElement;
            b.innerHTML = `Config ERROR: ${err_msg}`;
            overlay.classList.add("is-active");
        }
    };
    setupModalClose(overlay);

    const planBtn = document.getElementById("plan") as HTMLButtonElement;
    planBtn.addEventListener("click", (): void => planFromEditorValue());
    planFromEditorValue();

    // default to show diagram visualization
    showDiagram();
}

window.onload = main;
