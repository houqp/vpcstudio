import {
    Cluster,
    CidrBlock,
} from "./planner";

function genCidrstats(cidr: CidrBlock): string {
    return `
        <li>${cidr.ip_count} IPs, from ${cidr.ip_start} to ${cidr.ip_end}</li>
    `;
}

function genFreeCidrEntry(freecidr: CidrBlock): string {
    const entry_parts = [];
    entry_parts.push("<li>");
    entry_parts.push(`<span class="toggle">
        reserved CIDR (${freecidr.cidr})
    </span>`);
    {
        entry_parts.push("<ul class='nested'>");
        entry_parts.push(genCidrstats(freecidr));
        entry_parts.push("</ul>");
    }
    entry_parts.push("</li>");
    return entry_parts.join("\n");
}

function drawTree(cluster: Cluster): void {
    const div = (document.getElementById('tree') as HTMLElement);
    const tree_parts = ["<ul>"];

    for (const vpc of cluster.vpcs) {
        tree_parts.push("<li>");
        tree_parts.push(`<span class="toggle">
            Region <b>${vpc.name}</b> @ ${vpc.region} (${vpc.cidr})
        </span>`);

        tree_parts.push("<ul class='nested'>");
        tree_parts.push(genCidrstats(vpc));

        for (const zone of vpc.zones) {
            tree_parts.push("<li>");
            tree_parts.push(`<span class="toggle">
                Zone <b>${zone.zone}</b> (${zone.cidr})}
            </span>`);

            tree_parts.push("<ul class='nested'>");
            tree_parts.push(genCidrstats(zone));

            for (const subnet of zone.subnets) {
                tree_parts.push("<li>");
                tree_parts.push(`<span class="toggle">
                    Subnet <b>${subnet.name}</b> (${subnet.cidr})
                </span>`);
                tree_parts.push("<ul class='nested'>");
                tree_parts.push(genCidrstats(subnet));
                tree_parts.push("</ul>");
                tree_parts.push("</li>");
            }

            for (const freecidr of zone.freeCidrs) {
                tree_parts.push(genFreeCidrEntry(freecidr));
            }
            tree_parts.push("</ul>");

            tree_parts.push("</li>");
        }

        for (const freecidr of vpc.freeCidrs) {
            tree_parts.push(genFreeCidrEntry(freecidr));
        }

        tree_parts.push("</ul>");
        tree_parts.push("</li>");
    }

    for (const freecidr of cluster.freeCidrs) {
        tree_parts.push(genFreeCidrEntry(freecidr));
    }

    tree_parts.push("</ul>");
    div.innerHTML = tree_parts.join("\n");

    const togglers = document.getElementsByClassName("toggle");
    for (let i = 0; i < togglers.length; i++) {
        const toggler = togglers[i];
        toggler.addEventListener("click", function() {
            const nested_children = (toggler.parentElement as HTMLElement).querySelector(".nested");
            if (nested_children != null) {
                nested_children.classList.toggle("collapsed");
            }
            toggler.classList.toggle("hide-toggle");
        });
    }
}

export default drawTree;
