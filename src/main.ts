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
    constructor(err: E) {
        this.err = err;
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

let planClearCallbacks: Array<() => void> = [];

function resetPlanInteractions() {
    for (let cb of planClearCallbacks) {
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
    for (const subnet_name in cfg.subnet_routes) {
        if (!cfg.subnet_routes[subnet_name].size) {
            // default to medium size if not specified
            cfg.subnet_routes[subnet_name].size = "m";
        }
    }

    for (const region_name in cfg.regions) {
        const region = cfg.regions[region_name]
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

    const cidr = cfg["cidr"]
    const cluster = new Cluster(cfg.provider, cidr, cfg.regions, cfg.subnet_routes)

    drawDiagram(cluster, planClearCallbacks);
    drawTree(cluster);
    drawJSON(cluster);
    drawTerraform(cluster);
    drawPulumi(cluster);

    return null;
}

function setTabActive(target_tab: HTMLElement) {
    resetPlanInteractions();

    const vis_section = <HTMLElement>document.getElementById("vis");
    const active_tab = vis_section.querySelector(".is-active");
    if (active_tab != null && active_tab !== target_tab) {
        active_tab.classList.remove("is-active");
    }
    target_tab.classList.add("is-active");

    // hide container for all visualization
    const vis_container = <HTMLElement>document.getElementById("vis");
    const vis_boxes = vis_container.querySelectorAll(".container .box");
    for (let i = 0; i < vis_boxes.length; i ++) {
        const box = <HTMLElement>vis_boxes[i];
        box.style.display = "none";
    }

    // show container for selected visualization
    const vis_box_id = <string>target_tab.dataset.target;
    const box = <HTMLElement>document.getElementById(vis_box_id);
    box.style.display = "block";
}

function setupModalClose(modal: HTMLElement) {
    const bg = <HTMLElement>modal.querySelector(".modal-background");
    const close = <HTMLElement>modal.querySelector(".modal-close");
    const closeModal = () => {
        modal.classList.remove("is-active");
    }
    bg.addEventListener("click", closeModal);
    close.addEventListener("click", closeModal);
}

function main() {
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
    public:
        size: s
    private_company:
        size: m
    private_team:
        size: l
`
    editor.getSession().setValue(sampleConfig);

    const diagram_tab = <HTMLElement>document.getElementById("diagram-tab");
    const showDiagram = function(){
        setTabActive(diagram_tab);
    };
    diagram_tab.addEventListener("click", showDiagram);

    const tree_tab = <HTMLElement>document.getElementById("tree-tab");
    const showTree = function(){ setTabActive(tree_tab) };
    tree_tab.addEventListener("click", showTree);

    const terraform_tab = <HTMLElement>document.getElementById("terraform-tab");
    terraform_tab.addEventListener("click", function(){ setTabActive(terraform_tab) });

    const pulumi_tab = <HTMLElement>document.getElementById("pulumi-tab");
    pulumi_tab.addEventListener("click", function(){ setTabActive(pulumi_tab) });

    const json_tab = <HTMLElement>document.getElementById("json-tab");
    json_tab.addEventListener("click", function(){ setTabActive(json_tab) });

    const overlay = <HTMLElement>document.getElementById("message-overlay");
    const planFromEditorValue = function() {
        const err_msg = plan(editor.getSession().getValue());
        if (err_msg !== null) {
            const b = <HTMLElement>overlay.querySelector(".box p");
            b.innerHTML = `Config ERROR: ${err_msg}`;
            overlay.classList.add("is-active");
        }
    };
    setupModalClose(overlay);

    const planBtn = <HTMLButtonElement>document.getElementById("plan");
    planBtn.addEventListener("click", Event => planFromEditorValue());
    planFromEditorValue();

    // default to show diagram visualization
    showDiagram();
}

window.onload = main;
