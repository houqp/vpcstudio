import "mocha";
import { expect } from "chai";

import {
    Cluster,
    AssertValidRoute,
} from "./planner";

describe("Plan cluster", () => {
    it("should support cluster with 3 subnets with different sizes", () => {
        const c = new Cluster("aws", "10.0.0.0/15", {
            "prod": {
                region: "us-west-2",
                zone_count: 3,
            },
            "stg": {
                region: "us-west-2",
                zone_count: 3,
            },
            "dev": {
                region: "us-west-2",
                zone_count: 3,
            },
        }, {
            "public": { size: "l" },
            "private": { size: "m" },
            "private2": { size: "s" },
        })

        expect(c.ip_count).to.equal(131072);
        expect(c.vpcs.length).to.equal(3);
        expect(c.freeCidrs.length).to.equal(1);

        for (const vpc of c.vpcs) {
            expect(vpc.ip_count).to.equal(32768);
            for (const zone of vpc.zones) {
                expect(zone.ip_count).to.equal(8192);

                expect(zone.subnets.length).to.equal(3);
                expect(zone.freeCidrs.length).to.equal(1);

                expect(zone.subnets[0].ip_count).to.equal(4091);
                expect(zone.subnets[1].ip_count).to.equal(2043);
                expect(zone.subnets[2].ip_count).to.equal(1019);
                expect(zone.freeCidrs[0].ip_count).to.equal(1024);
            }
        }
        const vpc1 = c.vpcs[0];
        const zone1 = vpc1.zones[0];
        expect(zone1.cidr).to.equal("10.0.0.0/19");
        expect(zone1.subnets[0].cidr).to.equal("10.0.0.0/20");
        expect(zone1.subnets[1].cidr).to.equal("10.0.16.0/21");
        expect(zone1.subnets[2].cidr).to.equal("10.0.24.0/22");
        expect(zone1.freeCidrs[0].cidr).to.equal("10.0.28.0/22");
    });

    it("should support cluster with 2 subnets with different sizes", () => {
        const c = new Cluster("aws", "10.0.0.0/15", {
            "prod": {
                region: "us-west-2",
                zone_count: 3,
            },
            "stg": {
                region: "us-west-2",
                zone_count: 3,
            },
            "dev": {
                region: "us-west-2",
                zone_count: 3,
            },
        }, {
            "public": { size: "l" },
            "private": { size: "m" },
        })

        expect(c.ip_count).to.equal(131072);
        expect(c.vpcs.length).to.equal(3);
        expect(c.freeCidrs.length).to.equal(1);

        for (const vpc of c.vpcs) {
            expect(vpc.ip_count).to.equal(32768);
            for (const zone of vpc.zones) {
                expect(zone.ip_count).to.equal(8192);

                expect(zone.subnets.length).to.equal(2);
                expect(zone.freeCidrs.length).to.equal(1);

                expect(zone.subnets[0].ip_count).to.equal(4091);
                expect(zone.subnets[1].ip_count).to.equal(2043);
                expect(zone.freeCidrs[0].ip_count).to.equal(2048);
            }
        }
        const vpc1 = c.vpcs[0];
        const zone1 = vpc1.zones[0];
        expect(zone1.cidr).to.equal("10.0.0.0/19");
        expect(zone1.subnets[0].cidr).to.equal("10.0.0.0/20");
        expect(zone1.subnets[1].cidr).to.equal("10.0.16.0/21");
        expect(zone1.freeCidrs[0].cidr).to.equal("10.0.24.0/21");
    });

    it("should support cluster with 4 subnets with different sizes", () => {
        const c = new Cluster("aws", "10.0.0.0/15", {
            "prod": {
                region: "us-west-2",
                zone_count: 3,
            },
            "stg": {
                region: "us-west-2",
                zone_count: 3,
            },
            "dev": {
                region: "us-west-2",
                zone_count: 3,
            },
        }, {
            "public": { size: "l" },
            "private": { size: "m" },
            "a": { size: "s" },
            "b": { size: "s" },
        })

        expect(c.ip_count).to.equal(131072);
        expect(c.vpcs.length).to.equal(3);
        expect(c.freeCidrs.length).to.equal(1);

        for (const vpc of c.vpcs) {
            expect(vpc.ip_count).to.equal(32768);
            for (const zone of vpc.zones) {
                expect(zone.ip_count).to.equal(8192);

                expect(zone.subnets.length).to.equal(4);
                expect(zone.freeCidrs.length).to.equal(1);

                expect(zone.subnets[0].name).to.equal("public");
                expect(zone.subnets[0].ip_count).to.equal(2043);
                expect(zone.subnets[1].name).to.equal("private");
                expect(zone.subnets[1].ip_count).to.equal(1019);
                expect(zone.subnets[2].name).to.equal("a");
                expect(zone.subnets[2].ip_count).to.equal(507);
                expect(zone.subnets[3].name).to.equal("b");
                expect(zone.subnets[3].ip_count).to.equal(507);

                expect(zone.freeCidrs[0].ip_count).to.equal(4096);
            }
        }
        const vpc1 = c.vpcs[0];
        const zone1 = vpc1.zones[0];
        expect(zone1.cidr).to.equal("10.0.0.0/19");
        expect(zone1.subnets[0].name).to.equal("public");
        expect(zone1.subnets[0].cidr).to.equal("10.0.0.0/21");
        expect(zone1.subnets[1].cidr).to.equal("10.0.8.0/22");
        expect(zone1.subnets[2].cidr).to.equal("10.0.12.0/23");
        expect(zone1.subnets[3].cidr).to.equal("10.0.14.0/23");
        expect(zone1.freeCidrs[0].cidr).to.equal("10.0.16.0/20");
    });

    it("should cap VPC size to /16 for AWS provider", () => {
        const c = new Cluster("aws", "10.0.0.0/8", {
            "prod": {
                region: "us-west-2",
                zone_count: 3,
            },
            "stg": {
                region: "us-west-2",
                zone_count: 3,
            },
            "dev": {
                region: "us-west-2",
                zone_count: 3,
            },
        }, {
            "public": { size: "l" },
            "private": { size: "m" },
            "a": { size: "s" },
            "b": { size: "s" },
        })

        expect(c.ip_count).to.equal(16777216);
        expect(c.vpcs.length).to.equal(3);
        expect(c.freeCidrs.length).to.equal(253);

        for (const vpc of c.vpcs) {
            expect(vpc.ip_count).to.equal(65536);
        }
        const vpc1 = c.vpcs[0];
        expect(vpc1.cidr).to.equal("10.0.0.0/16");
        const zone1 = vpc1.zones[0];
        expect(zone1.cidr).to.equal("10.0.0.0/18");
        expect(zone1.subnets[0].name).to.equal("public");
        expect(zone1.subnets[0].cidr).to.equal("10.0.0.0/20");
        expect(zone1.subnets[1].cidr).to.equal("10.0.16.0/21");
        expect(zone1.subnets[2].cidr).to.equal("10.0.24.0/22");
        expect(zone1.subnets[3].cidr).to.equal("10.0.28.0/22");
        expect(zone1.freeCidrs[0].cidr).to.equal("10.0.32.0/19");
    });
});


describe("Validate route config", () => {
    it("should reject cidr too small", () => {
        const re = AssertValidRoute("10.0.0.0/28", 3, 3, {
            "a": { "size": "s" },
            "b": { "size": "s" },
            "c": { "size": "s" },
        });
        expect(re).to.equal("Given CIDR is too small to meet region and zone requirements.");
    });

    it("should reject too many large subnets", () => {
        let re = AssertValidRoute("10.0.0.0/15", 3, 3, {
            "a": { "size": "l" },
            "b": { "size": "l" },
            "c": { "size": "s" },
        });
        expect(re).to.equal("Invalid route size configuration, sum of all route size is too large.");

        re = AssertValidRoute("10.0.0.0/15", 3, 3, {
            "a": { "size": "l" },
            "b": { "size": "l" },
        });
        expect(re).to.equal("Invalid route size configuration, sum of all route size is too large.");

        re = AssertValidRoute("10.0.0.0/15", 3, 3, {
            "a": { "size": "l" },
        });
        expect(re).to.equal("Invalid route size configuration, sum of all route size is too large.");
    });

    it("should reject too many medium subnets", () => {
        const re = AssertValidRoute("10.0.0.0/15", 3, 3, {
            "a": { "size": "l" },
            "b": { "size": "m" },
            "c": { "size": "m" },
        });
        expect(re).to.equal("Invalid route size configuration, sum of all route size is too large.");
    });

    it("should accept valid subnet routess", () => {
        const re = AssertValidRoute("10.0.0.0/15", 3, 3, {
            "a": { "size": "m" },
            "b": { "size": "l" },
            "c": { "size": "s" },
        });
        expect(re).to.equal(null);
    });

    it("should accept valid subnet routess 2 medium sizes", () => {
        let re = AssertValidRoute("10.0.0.0/15", 3, 3, {
            "a": { "size": "m" },
            "b": { "size": "m" },
        });
        expect(re).to.equal(null);

        re = AssertValidRoute("10.0.0.0/15", 3, 3, {
            "a": { "size": "m" },
        });
        expect(re).to.equal(null);
    });

    it("should accept valid subnet routes 3 medium sizes", () => {
        const re = AssertValidRoute("10.0.0.0/15", 3, 3, {
            "a": { "size": "m" },
            "b": { "size": "m" },
            "c": { "size": "m" },
        });
        expect(re).to.equal(null);
    });

    it("should accept valid subnet routes large and small", () => {
        const re = AssertValidRoute("10.0.0.0/15", 3, 3, {
            "a": { "size": "l" },
            "b": { "size": "s" },
            "c": { "size": "s" },
            "d": { "size": "s" },
            "e": { "size": "s" },
            "f": { "size": "s" },
            "g": { "size": "s" },
        });
        expect(re).to.equal(null);
    });
});
