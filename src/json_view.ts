import {
    Cluster,
} from "./planner";

function drawJSON(cluster: Cluster): void {
    const regions = [];
    for (const vpc of cluster.vpcs) {
        regions.push(vpc.toJSON());
    }
    const json_text = JSON.stringify(regions, null, 4);

    const div = document.getElementById('json') as HTMLElement;
    div.innerHTML = `<pre>${json_text}</pre>`
}

export default drawJSON;
