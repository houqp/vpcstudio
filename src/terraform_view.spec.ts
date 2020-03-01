import "mocha";
import { expect } from "chai";

import {
    VPC,
} from "./planner";

import {
    renderVPCTemplate
} from "./terraform_view";


describe("Render Terrform", () => {
    it("should render with only public subnet", () => {
        const re = renderVPCTemplate(new VPC(
            "aws",
            "10.0.0.0/19",
            "us-west-2",
            2,
            {
                "public_foo": {
                    size: "l",
                },
            },
            "test",
        ));
        expect(re).to.equal(`
module "vpc-test" {
  source = "terraform-aws-modules/vpc/aws"

  name = "test"
  cidr = "10.0.0.0/19"

  azs             = ["us-west-2a", "us-west-2b"]
  public_subnets = concat(local.subnet_routes["test"]["public_foo"])

  enable_nat_gateway = true
  enable_vpn_gateway = true

  tags = local.vpc_common_tags
}`);
    });
});
