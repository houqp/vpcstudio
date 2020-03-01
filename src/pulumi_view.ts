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
    intra_subnets: SubnetEntry[];
}

export function renderVPCTemplate(opts: VPCTemplateVars): string {
    // subnet args attributes: https://www.pulumi.com/docs/reference/pkg/nodejs/pulumi/awsx/ec2/#VpcSubnetArgs
    const private_subnets = [];
    for (const sn of opts.private_subnets) {
        private_subnets.push(`        {
            type: "private",
            name: "${sn.name}",
            location: {cidrBlock: "${sn.cidr}", availabilityZone: "${sn.zone}"},
            tags: vpc_common_tags,
        },`);
    }

    const public_subnets = [];
    for (const sn of opts.public_subnets) {
        public_subnets.push(`        {
            type: "public",
            name: "${sn.name}",
            location: {cidrBlock: "${sn.cidr}", availabilityZone: "${sn.zone}"},
            tags: vpc_common_tags,
        },`);
    }

    const intra_subnets = [];
    for (const sn of opts.intra_subnets) {
        intra_subnets.push(`        {
            type: "isolated",
            name: "${sn.name}",
            location: {cidrBlock: "${sn.cidr}", availabilityZone: "${sn.zone}"},
            tags: vpc_common_tags,
        },`);
    }


    let parts = [`
vpcs["${opts.name}"] = new awsx.ec2.Vpc("${opts.name}", {
    cidrBlock: "${opts.cidr}",
    numberOfAvailabilityZones: "all",
    subnets: [`,
    ];

    if (private_subnets.length > 0) {
        parts = parts.concat(private_subnets);
    }

    if (public_subnets.length > 0) {
        parts = parts.concat(public_subnets);
    }

    if (intra_subnets.length > 0) {
        parts = parts.concat(intra_subnets);
    }

    parts.push(`    ],
    tags: vpc_common_tags,
});`);
    return parts.join("\n");
}

function drawPulumi(cluster: Cluster): void {
    const code_parts = [
        `import * as awsx from "@pulumi/awsx";`,
        `
const vpc_common_tags = {
    "Terraform": "true",
    "Source": "vpcstudio",
};
const vpcs: { [index: string]: awsx.ec2.Vpc } = {};`,
    ];

    for (const vpc of cluster.vpcs) {
        const vpc_opts = {
            name: vpc.name,
            cidr: vpc.cidr,
            public_subnets: [] as SubnetEntry[],
            private_subnets: [] as SubnetEntry[],
            intra_subnets: [] as SubnetEntry[],
        };

        for (const zone of vpc.zones) {
            for (const subnet of zone.subnets) {
                if (subnet.name === "public" || subnet.name.startsWith("public_")) {
                    vpc_opts.public_subnets.push(subnet);
                } else if (subnet.name === "intra" || subnet.name.startsWith("intra_")) {
                    vpc_opts.intra_subnets.push(subnet);
                } else {
                    vpc_opts.private_subnets.push(subnet);
                }
            }
        }

        code_parts.push(renderVPCTemplate(vpc_opts));
    }

    code_parts.push("\nexport {vpcs};");
    const code = code_parts.join("\n");
    const div = document.getElementById('pulumi') as HTMLElement;
    div.innerHTML = `<pre>${code}</pre>`
}

export default drawPulumi;
