import "mocha";
import { expect } from "chai";

import {
    renderVPCTemplate
} from "./pulumi_view";


describe("Render Pulumi", () => {
    it("should render with only intra subnet", () => {
        const re = renderVPCTemplate({
            name: "foo",
            cidr: "10.0.0.0/19",
            intra_subnets: [{
                name: "intra_infra",
                cidr: "10.0.0.0/20",
                zone: "us-west-2a",
            },{
                name: "intra_infra",
                cidr: "10.0.16.0/20",
                zone: "us-west-2b",
            }],
            public_subnets: [],
            private_subnets: [],
        });
        expect(re).to.equal(`
vpcs["foo"] = new awsx.ec2.Vpc("foo", {
    cidrBlock: "10.0.0.0/19",
    numberOfAvailabilityZones: "all",
    subnets: [
        {
            type: "isolated",
            name: "intra_infra",
            location: {cidrBlock: "10.0.0.0/20", availabilityZone: "us-west-2a"},
            tags: vpc_common_tags,
        },
        {
            type: "isolated",
            name: "intra_infra",
            location: {cidrBlock: "10.0.16.0/20", availabilityZone: "us-west-2b"},
            tags: vpc_common_tags,
        },
    ],
    tags: vpc_common_tags,
});`);
    });
});
