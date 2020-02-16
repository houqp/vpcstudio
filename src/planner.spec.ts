import "mocha";
import { expect } from "chai";

import { Cluster } from "./planner";

describe("123", () => {
    it("should support cluster with 3 subnets", () => {
        const c = new Cluster("aws", "10.0.0.0/18", {
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
            "public": {
                size: "l",
            },
            "private": {
                size: "m",
            },
            "private2": {
                size: "s",
            },
        })

        expect(c.ip_count).to.equal(16384);
    });
});
