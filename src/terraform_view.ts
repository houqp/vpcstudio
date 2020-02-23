import {
    Cluster,
    VPC,
} from "./planner";

interface VPCTemplateVars {
    name: string;
    cidr: string;
    zones: string[];
    public_subnets: string[];
    private_subnets: string[];
}

function renderVPCSubnetRoutes(vpc: VPC): string {
    const subnet_cidrs: { [index: string]: string[]} = {};
    for (const zone of vpc.zones) {
        for (const subnet of zone.subnets) {
            if (!subnet_cidrs.hasOwnProperty(subnet.name)) {
                subnet_cidrs[subnet.name] = [];
            }
            subnet_cidrs[subnet.name].push(`"${subnet.cidr}"`);
        }
    }

    const parts = [`    "${vpc.name}" = {`
    ];

    for (const route of Object.keys(subnet_cidrs)) {
        const cidrs = subnet_cidrs[route];
        parts.push(`      "${route}" = [${cidrs.join(", ")}]`);
    }

    parts.push(`    }`);

    return parts.join("\n");
}

function renderVPCTemplate(vpc: VPC): string {
    const zones = [];
    for (const zone of vpc.zones) {
        zones.push(`"${zone.zone}"`);
    }

    const public_subnets = [];
    const private_subnets = [];
    for (const route_name of Object.keys(vpc.subnet_routes)) {
        if (route_name === "public" || route_name.startsWith("public_")) {
            public_subnets.push(`local.subnet_routes["${vpc.name}"]["${route_name}"]`);
        } else {
            private_subnets.push(`local.subnet_routes["${vpc.name}"]["${route_name}"]`);
        }
    }

    return `
module "vpc-${vpc.name}" {
  source = "terraform-aws-modules/vpc/aws"

  name = "${vpc.name}"
  cidr = "${vpc.cidr}"

  azs             = [${zones.join(", ")}]
  private_subnets = concat(${private_subnets.join(", ")})
  public_subnets  = concat(${public_subnets.join(", ")})

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
        ``,
        `  subnet_routes = {`,
    ];

    // render local variables
    for (const vpc of cluster.vpcs) {
        code_parts.push(renderVPCSubnetRoutes(vpc));
    }

    code_parts.push("  }");
    code_parts.push("}");

    // render module call
    for (const vpc of cluster.vpcs) {
        code_parts.push(renderVPCTemplate(vpc));
    }

    const code = code_parts.join("\n");
    const div = document.getElementById('terraform') as HTMLElement;
    div.innerHTML = `<pre>${code}</pre>`
}

export default drawTerraform;
