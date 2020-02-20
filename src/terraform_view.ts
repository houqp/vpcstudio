import {
    Cluster,
} from "./planner";

interface VPCTemplateVars {
    name: string;
    cidr: string;
    zones: string[];
    public_subnets: string[];
    private_subnets: string[];
}

function renderVPCTemplate(opts: VPCTemplateVars): string {
    const private_subnets = [];
    for (const cidr of opts.private_subnets) {
        private_subnets.push(`"${cidr}"`);
    }

    const public_subnets = [];
    for (const cidr of opts.public_subnets) {
        public_subnets.push(`"${cidr}"`);
    }

    const zones = [];
    for (const zone of opts.zones) {
        zones.push(`"${zone}"`);
    }

    return `
module "vpc-${opts.name}" {
  source = "terraform-aws-modules/vpc/aws"

  name = "${opts.name}"
  cidr = "${opts.cidr}"

  azs             = [${zones.join(", ")}]
  private_subnets = [${private_subnets.join(", ")}]
  public_subnets  = [${public_subnets.join(", ")}]

  enable_nat_gateway = true
  enable_vpn_gateway = true

  tags = local.vpc_common_tags
}`;
}

function drawTerraform(cluster: Cluster): void {
    const code_parts = [
        "locals {",
        `  vpc_common_tags = {`,
        `    Terraform = "true"`,
        `    Source    = "vpcstudio"`,
        `  }`,
        "}",
    ];

    for (const vpc of cluster.vpcs) {
        const vpc_opts = {
            name: vpc.name,
            cidr: vpc.cidr,
            zones: [] as string[],
            public_subnets: [] as string[],
            private_subnets: [] as string[],
        };

        for (const zone of vpc.zones) {
            vpc_opts.zones.push(zone.zone);

            for (const subnet of zone.subnets) {
                if (subnet.name === "public" || subnet.name.startsWith("public_")) {
                    vpc_opts.public_subnets.push(subnet.cidr);
                } else {
                    vpc_opts.private_subnets.push(subnet.cidr);
                }
            }
        }

        code_parts.push(renderVPCTemplate(vpc_opts));
    }

    const code = code_parts.join("\n");
    const div = document.getElementById('terraform') as HTMLElement;
    div.innerHTML = `<pre>${code}</pre>`
}

export default drawTerraform;
