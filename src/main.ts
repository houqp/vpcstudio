import Yaml from "js-yaml";
import {
    Cluster,
    RegionsConfig,
    SubnetRoutes,
} from "./planner";
import drawTree from "./tree_view";
import drawDiagram from "./diagram_view";

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
}

function setTabActive(target_tab: HTMLElement) {
    const vis_section = <HTMLElement>document.getElementById("vis");
    const active_tab = <HTMLElement>vis_section.querySelector(".is-active");
    if (active_tab !== target_tab) {
        active_tab.classList.remove("is-active");
    }
    target_tab.classList.add("is-active");
}

function hideVisBox(box_id: string) {
    const box = <HTMLElement>document.getElementById(box_id);
    box.style.display = "none";
}

function showVisBox(box_id: string) {
    const box = <HTMLElement>document.getElementById(box_id);
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
    "us-west-2":
        zone_count: 3
    "us-east-2":
        zone_count: 3
    "sa-east-1":
        zone_count: 3
    "eu-north-1":
        zone_count: 3
# define subnets within each zone
subnet_routes:
    public:
        size: s
    company_internal:
        size: m
    team_internal:
        size: l
`
    editor.getSession().setValue(sampleConfig);

    const diagram_tab = <HTMLElement>document.getElementById("diagram-tab");
    const showDiagram = function(){
        resetPlanInteractions();
        setTabActive(diagram_tab);
        hideVisBox("tree-container");
        showVisBox("diagram-container");
    };
    diagram_tab.addEventListener("click", showDiagram);

    const tree_tab = <HTMLElement>document.getElementById("tree-tab");
    const showTree = function(){
        resetPlanInteractions();
        setTabActive(tree_tab);
        hideVisBox("diagram-container");
        showVisBox("tree-container");
    };
    tree_tab.addEventListener("click", showTree);

    // default to show diagram visualization
    showDiagram();

    const planFromEditorValue = function() {
        plan(editor.getSession().getValue());
    };

    const planBtn = <HTMLButtonElement>document.getElementById("plan");
    planBtn.addEventListener("click", Event => planFromEditorValue());
    planFromEditorValue();
}

window.onload = main;
