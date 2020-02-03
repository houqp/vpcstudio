import {
    Cluster,
} from "./planner";

function drawJSON(cluster: Cluster) {
    let regions = [];
    for (const vpc of cluster.vpcs) {
        regions.push(vpc.toJSON());
    }
    const json_text = JSON.stringify(regions, null, 4);

    let div = <HTMLElement>document.getElementById('json');
    div.innerHTML = `<pre>${json_text}</pre>`
}

export default drawJSON;
