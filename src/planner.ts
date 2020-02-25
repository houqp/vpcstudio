import {
    CidrBlock,
    cidrMask,
    cidrCountIps,
    cidrSubnets,
    IpSet,
} from "./cidrtools";

interface SubnetRoute {
    size: "s"|"m"|"l";
}

const route_size_mask_diff = {
    "s": 1,
    "m": 0,
    "l": -1,
};

export type SubnetRoutes = { [index: string]: SubnetRoute };

interface RegionConfig {
    region: string;
    zone_count: number;
}

export type RegionsConfig = { [index: string]: RegionConfig };

class FreeCidr extends CidrBlock {
    constructor(cidr: string) {
        super(cidr);
    }
    toJSON(): object {
        return {
            cidr: this.cidr,
        };
    }
}

/**
 * 2 -> 2
 * 3 -> 2
 * 4 -> 3
 */
const log2ceil = (x: number): number => Math.ceil(Math.log2(x+1));

/**
 * number of cidr mask bits inorder to represent given number of subnets + one
 * extra reserved spott
 *
 * 2 bits equals to 4 spots, which means we can have 1 reserved spot and less
 * than 4 subnets
 *
 * 3 bits equals to 9 spots, which means we can have 1 reserved spot and less
 * than 9 subnets
 */
const count2CidrMaskBits = log2ceil;

export class Subnet extends CidrBlock {
    provider: string;
    name: string;
    zone: string;

    constructor(
        provider: string, cidr: string, name: string, zone: string,
    ) {
        super(cidr);
        this.provider = provider;
        this.name = name;
        this.zone = zone;
        switch (provider) {
            case "aws": {
                // From AWS doc: The first 4 IP addresses and the last IP
                // address in each subnet // CIDR block are not available for you
                // to use and cannot be assigned // to an instance.
                this.ip_count -= 5;
                break;
            }
        }
    }

    toJSON(): object {
        return {
            name: this.name,
            cidr: this.cidr,
        };
    }
}

interface ZonePlanResult {
    subnets: Subnet[];
    freeCidrs: FreeCidr[];
}

function planZone(
    provider: string, cidr: string, subnet_routes: SubnetRoutes, zone: string,
): ZonePlanResult {
    const routes = [];
    for (const route_name in subnet_routes) {
        routes.push({
            name: route_name,
            size_mask_diff: route_size_mask_diff[subnet_routes[route_name].size],
        });
    }
    const sorted_routes = routes.sort((x, y) => x.size_mask_diff - y.size_mask_diff);
    const subnet_cnt = sorted_routes.length;
    const subnet_mask = cidrMask(cidr) + count2CidrMaskBits(subnet_cnt);

    const avail_ipset = new IpSet([cidr]);
    const subnets = [];
    const freeCidrs = [];

    for (const route of sorted_routes) {
        const subnet_cidr = avail_ipset.nextCidr(subnet_mask + route.size_mask_diff);
        avail_ipset.subtract(subnet_cidr);

        subnets.push(new Subnet(
            provider,
            subnet_cidr,
            route.name,
            zone,
        ));
        if (avail_ipset.ipCount() == 0) {
            break;
        }
    }

    for (const avail_cidr of avail_ipset.getCidrs()) {
        freeCidrs.push(new FreeCidr(avail_cidr));
    }

    return {
        subnets: subnets,
        freeCidrs: freeCidrs,
    };
}

export class Zone extends CidrBlock {
    // input
    provider: string;
    subnet_routes: SubnetRoutes;
    name: string;
    zone: string;
    // output
    subnets: Subnet[];
    freeCidrs: FreeCidr[];

    constructor(
        provider: string, cidr: string, subnet_routes: SubnetRoutes, name: string | null = null, zone: string,
    ) {
        super(cidr);
        this.subnet_routes = subnet_routes;
        if (name !== null) {
            this.name = name;
        } else {
            this.name = "unnamed";
        }
        this.zone = zone;
        this.provider = provider;

        const re = planZone(provider, cidr, subnet_routes, this.zone);
        this.subnets = re.subnets;
        this.freeCidrs = re.freeCidrs;
    }

    toJSON(): object {
        const zone = {
            name: this.name,
            zone: this.zone,
            cidr: this.cidr,
            subnets: [] as object[],
            reserved_cidrs: [] as object[],
        };
        for (const subnet of this.subnets) {
            zone.subnets.push(subnet.toJSON());
        }
        for (const freecidr of this.freeCidrs) {
            zone.reserved_cidrs.push(freecidr.toJSON());
        }
        return zone
    }
}

interface VPCPlanResult {
    zones: Zone[];
    freeCidrs: FreeCidr[];
}

function planVPC(provider: string, cidr: string, region: string, zone_count: number, subnet_routes: SubnetRoutes): VPCPlanResult {
    const zone_mask = cidrMask(cidr) + count2CidrMaskBits(zone_count);

    const zones = [];
    const freeCidrs = [];

    let idx = 0;
    for (const zone_cidr of cidrSubnets(cidr, zone_mask)) {
        if (idx >= zone_count) {
            freeCidrs.push(new FreeCidr(zone_cidr));
        } else {
            const zone_suffix = String.fromCharCode(97+idx);
            zones.push(new Zone(
                provider,
                zone_cidr,
                subnet_routes,
                zone_suffix,
                `${region}${zone_suffix}`,
            ));
        }

        idx += 1;
    }

    return {
        zones: zones,
        freeCidrs: freeCidrs,
    };
}


export class VPC extends CidrBlock {
    // input
    provider: string;
    subnet_routes: SubnetRoutes;
    zone_count: number;
    name: string;
    region: string;
    // output
    zones: Zone[];
    freeCidrs: FreeCidr[];

    constructor(
        provider: string,
        cidr: string,
        region: string,
        zone_count: number,
        subnet_routes: SubnetRoutes,
        name: string | null = null,
    ) {
        super(cidr);
        this.zone_count = zone_count;
        this.subnet_routes = subnet_routes;
        this.region = region;
        this.provider = provider;
        if (name === null) {
            this.name = "unnamed";
        } else {
            this.name = name;
        }

        const re = planVPC(provider, cidr, region, zone_count, subnet_routes);
        this.zones = re.zones;
        this.freeCidrs = re.freeCidrs;
    }

    toJSON(): object {
        const vpc = {
            name: this.name,
            region: this.region,
            cidr: this.cidr,
            zones: [] as object[],
            reserved_cidrs: [] as object[],
        };
        for (const zone of this.zones) {
            vpc.zones.push(zone.toJSON());
        }
        for (const freecidr of this.freeCidrs) {
            vpc.reserved_cidrs.push(freecidr.toJSON());
        }
        return vpc;
    }
}

interface ClusterPlanResult {
    vpcs: VPC[];
    freeCidrs: FreeCidr[];
}

function planCluster(provider: string, cidr: string, regions: RegionsConfig, subnet_routes: SubnetRoutes): ClusterPlanResult {
    const region_names = Object.keys(regions);
    const region_cnt = region_names.length;
    const region_mask = cidrMask(cidr) + count2CidrMaskBits(region_cnt);
    const vpcs = [];
    const freeCidrs = [];

    let idx = 0;
    const region_cidrs = cidrSubnets(cidr, region_mask);
    for (const region_cidr of region_cidrs) {
        if (idx >= region_cnt) {
            freeCidrs.push(new FreeCidr(region_cidr));
        } else {
            const vpc_name = region_names[idx];
            vpcs.push(new VPC(
                provider,
                region_cidr,
                regions[vpc_name].region,
                regions[vpc_name].zone_count,
                subnet_routes,
                vpc_name,
            ));
        }

        idx += 1;
    }

    return {
        vpcs: vpcs,
        freeCidrs: freeCidrs,
    };
}

export class Cluster {
    // input
    cidr: string;
    regions: RegionsConfig;
    subnet_routes: SubnetRoutes;
    provider: string;
    // output
    ip_count: number;
    vpcs: VPC[];
    freeCidrs: FreeCidr[];

    constructor(
        provider: string, cidr: string, regions: RegionsConfig, subnet_routes: SubnetRoutes,
    ) {
        this.cidr = cidr;
        this.regions = regions;
        this.subnet_routes = subnet_routes;
        this.provider = provider;

        this.ip_count = cidrCountIps(cidr);
        const re = planCluster(provider, cidr, regions, subnet_routes);
        this.vpcs = re.vpcs;
        this.freeCidrs = re.freeCidrs;
    }
}

export function AssertValidRoute(
    cidr: string, region_count: number, zone_count: number, routes: SubnetRoutes,
): string | null {
    // Allocate CIDR ranges using a balanced binary tree
    //
    // Let total_units = 2^log2ceil(subnet_count) * 2
    // constraints:
    //  l_unit = 4
    //  m_unit = 2
    //  s_unit = 1
    //
    //  l_count <= total_units / 4 - 1
    //  m_count <= total_units / 2 - 4 * l_count - 1
    //  s_count <= total_units - 2 * m_count - 4 * l_count - 1
    //
    // Tree view:
    //
    //         L
    //      M     M
    //     S S   S S
    const cidr_mask = cidrMask(cidr);
    const avail_cidr_mask_bits = 32 - cidr_mask - count2CidrMaskBits(region_count) - count2CidrMaskBits(zone_count);

    if (avail_cidr_mask_bits <= 0) {
        return "Given CIDR is too small to meet region and zone requirements.";
    }

    const subnet_route_count = Object.keys(routes).length;
    const subnet_cidr_mask_bits = count2CidrMaskBits(subnet_route_count);
    const total_units = Math.pow(2, subnet_cidr_mask_bits) * 2;
    let avail_units = total_units;

    for (const route_name in routes) {
        const size = routes[route_name].size;
        switch (size) {
            case "l": {
                avail_units -= 4;
                break;
            }
            case "m": {
                avail_units -= 2;
                break;
            }
            case "s": {
                avail_units -= 1;
                break;
            }
            default: {
                return `invalid size "${size}" for route: ${route_name}`
            }
        }
        if (avail_units <= 0) {
            // avail_units == 0 means we don't have space for reserved cidr range
            return "Invalid route size configuration, sum of all route size is too large.";
        }
    }

    return null
}
