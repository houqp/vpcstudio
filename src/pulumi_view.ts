import {
    Cluster,
} from "./planner";

interface SubnetEntry {
    name: string;
    cidr: string;
    zone: string;
}

interface VPCTemplateVars {
    name: string;
    cidr: string;
    public_subnets: SubnetEntry[];
    private_subnets: SubnetEntry[];
}

function renderVPCTemplate(opts: VPCTemplateVars): string {
    const private_subnets = [];
    for (const sn of opts.private_subnets) {
        private_subnets.push(`        {
            type: "private",
            name: "${sn.name}",
            location: {cidrBlock: "${sn.cidr}", availabilityZone: "${sn.zone}"},
            tags: vpc_common_tags,
        }`);
    }

    const public_subnets = [];
    for (const sn of opts.public_subnets) {
        public_subnets.push(`        {
            type: "public",
            name: "${sn.name}",
            location: {cidrBlock: "${sn.cidr}", availabilityZone: "${sn.zone}"},
            tags: vpc_common_tags,
        }`);
    }

    return `
vpcs["${opts.name}"] = new awsx.ec2.Vpc("${opts.name}", {
    cidrBlock: "${opts.cidr}",
    numberOfAvailabilityZones: "all",
    subnets: [
${private_subnets.join("\n")}
${public_subnets.join("\n")}
    ],
    tags: vpc_common_tags,
});`;
}

function drawPulumi(cluster: Cluster): void {
    const code_parts = [
        `import * as awsx from "@pulumi/awsx";`,
        `
const vpc_common_tags = {
    "Terraform": "true",
    "Source": "vpcstudio",
};
let vpcs = {};`,

    ];

    for (const vpc of cluster.vpcs) {
        const vpc_opts = {
            name: vpc.name,
            cidr: vpc.cidr,
            public_subnets: [] as SubnetEntry[],
            private_subnets: [] as SubnetEntry[],
        };

        for (const zone of vpc.zones) {
            for (const subnet of zone.subnets) {
                if (subnet.name === "public" || subnet.name.startsWith("public_")) {
                    vpc_opts.public_subnets.push(subnet);
                } else {
                    vpc_opts.private_subnets.push(subnet);
                }
            }
        }

        code_parts.push(renderVPCTemplate(vpc_opts));
    }

    code_parts.push("\nexport vpcs;");
    const code = code_parts.join("\n");
    const div = document.getElementById('pulumi') as HTMLElement;
    div.innerHTML = `<pre>${code}</pre>`
}

export default drawPulumi;
