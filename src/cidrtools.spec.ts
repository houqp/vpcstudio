import "mocha";
import { expect } from "chai";

import {
    cidrToRange,
    IpSet,
    rangeToCidrs,
    posToIp,
    cidrSubnets,
} from "./cidrtools";

describe("IpSet", () => {
    it("should initialize with cidr list in the right order", () => {
        const ipset = new IpSet(["101.0.0.0/19", "101.1.0.0/20", "10.0.0.0/19"])
        const cidrs = ipset.getCidrs();
        expect(cidrs.length).to.equal(3);
        expect(cidrs[0]).to.equal("10.0.0.0/19");
        expect(cidrs[1]).to.equal("101.0.0.0/19");
        expect(cidrs[2]).to.equal("101.1.0.0/20");
    });
});

describe("IP calculation", () => {
    it("should convert pos to IP", () => {
        expect(posToIp(167774208)).to.equal("10.0.8.0");
    });
});

describe("Cidr calculation", () => {
    it("should calculate range from cidr", () => {
        const [min, max] = cidrToRange("10.0.8.0/20");
        expect(min).to.equal(167774208);
        expect(max).to.equal(167778303);
    });

    it("should calculate cidr list from range", () => {
        const cidrs = rangeToCidrs(167774208, 167780351);
        expect(cidrs.length).to.equal(2);
        expect(cidrs[0]).to.equal("10.0.8.0/20");
        expect(cidrs[1]).to.equal("10.0.24.0/21");
    });

    it("should subtract cidr", () => {
        const ipset = new IpSet(["10.0.0.0/19"])
        let cidrs = ipset.getCidrs();
        expect(cidrs.length).to.equal(1);
        expect(cidrs[0]).to.equal("10.0.0.0/19");

        ipset.subtract("10.0.0.0/21");
        cidrs = ipset.getCidrs();
        expect(cidrs.length).to.equal(2);
        expect(cidrs[0]).to.equal("10.0.8.0/20");
        expect(cidrs[1]).to.equal("10.0.24.0/21");
    });

    it("should generate subnets for cidr by mask", () => {
        const cidrs = cidrSubnets("192.168.0.0/16", 18)
        expect(cidrs.length).to.equal(4);
        expect(cidrs[0]).to.equal("192.168.0.0/18");
        expect(cidrs[1]).to.equal("192.168.64.0/18");
        expect(cidrs[2]).to.equal("192.168.128.0/18");
        expect(cidrs[3]).to.equal("192.168.192.0/18");
    });
});
