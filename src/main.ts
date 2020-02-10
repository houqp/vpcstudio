import Yaml from "js-yaml";
import {
    Cluster,
    RegionsConfig,
    SubnetRoutes,
} from "./planner";
import drawTree from "./tree_view";
import drawDiagram from "./diagram_view";
import drawJSON from "./json_view";
import drawTerraform from "./terraform_view";

interface PlanConfig {
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

function plan(cfgStr: string) {
    resetPlanInteractions();
    planClearCallbacks = [];

    const cfg = <PlanConfig>Yaml.safeLoad(cfgStr);

    // TODO: assertValidRoute

    const cidr = cfg["cidr"]
    const cluster = new Cluster(cidr, cfg.regions, cfg.subnet_routes)

    drawDiagram(cluster, planClearCallbacks);
    drawTree(cluster);
    drawJSON(cluster);
    drawTerraform(cluster);
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

function main() {
    const editor = ace.edit("config");
    editor.setTheme("ace/theme/tomorrow");
    editor.session.setMode("ace/mode/yaml");

    const sampleConfig = `provider: aws
cidr: "10.10.0.0/15"
# define number of VPCs and number of zones within each VPC
regions:
    "us-west":
        region: "us-west-2"
        zone_count: 3
    "us-east":
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

    const json_tab = <HTMLElement>document.getElementById("json-tab");
    json_tab.addEventListener("click", function(){ setTabActive(json_tab) });

    const planFromEditorValue = function() {
        plan(editor.getSession().getValue());
    };

    const planBtn = <HTMLButtonElement>document.getElementById("plan");
    planBtn.addEventListener("click", Event => planFromEditorValue());
    planFromEditorValue();

    // default to show diagram visualization
    showDiagram();
}

window.onload = main;
