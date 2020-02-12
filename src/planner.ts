import {
    cidr as Cidr,
    ip as Ip,
} from "node-cidr";

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

export class CidrBlock {
    // input
    cidr: string;
    // output
    ip_count: number;
    ip_start: string;
    ip_end: string;

    constructor(cidr: string) {
        this.cidr = cidr;
        this.ip_count = Cidr.count(cidr);
        this.ip_start = Cidr.min(cidr);
        this.ip_end = Cidr.max(cidr);
    }
}

class FreeCidr extends CidrBlock {
    constructor(cidr: string) {
        super(cidr);
    }
    toJSON(): Object {
        return {
            cidr: this.cidr,
        };
    }
}

const intCommonCidr = (ips: number[]): string => {
  const ipInt = ips.sort();
  let mask = 0;
  const range = ipInt[ipInt.length - 1] - ipInt[0];
  let baseIp = ipInt[0];
  for (let i = 0; i <= 32; i++) {
    mask = 32 - i;
    const exp = 2 ** (32 - mask);
    if (exp - 1 >= range) {
      if (ipInt[0] % exp != 0) {
        baseIp = ipInt[0] - ipInt[0] % exp;
      }
      if (ipInt[ipInt.length - 1] > baseIp + exp) {
        mask--;
      }
      break;
    }
  }
  return `${Ip.toString(baseIp)}/${mask}`;
};

/**
 * 2 -> 2
 * 3 -> 2
 * 4 -> 3
 */
const log2ceil = (x: number) => Math.ceil(Math.log2(x+1));

const cidrSubtract = (xcidr: string, ycidr: string): string | null => {
    const [xmin, xmax] = Cidr.toIntRange(xcidr);
    const [ymin, ymax] = Cidr.toIntRange(ycidr);

    if (xmin > ymin || xmax < ymax) {
        // xcidr needs to be a super set of ycidr
        return null;
    }

    let new_min: number;
    let new_max: number;
    if (xmin == ymin) {
        new_min = ymax+1;
        new_max = xmax;
    } else if (xmax == ymax) {
        new_min = xmin;
        new_max = ymin-1;
    } else {
        // ycidr needs to be either a prefix or suffix of xcidr
        return null;
    }

    if (new_min > new_max) {
        // FIXME: return 0 when new_min == new_max
        return null;
    }

    return intCommonCidr([new_min, new_max]);
};

export class Subnet extends CidrBlock {
    provider: string
    name: string;

    constructor(
        provider: string, cidr: string, name: string,
    ) {
        super(cidr);
        this.provider = provider;
        this.name = name;
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

    toJSON(): Object {
        let subnet = {
            name: this.name,
            cidr: this.cidr,
        };
        return subnet
    }
}

interface ZonePlanResult {
    subnets: Array<Subnet>;
    freeCidrs: Array<FreeCidr>;
}

function planZone(provider: string, cidr: string, subnet_routes: SubnetRoutes): ZonePlanResult {
    let routes = [];
    for (let route_name in subnet_routes) {
        routes.push({
            name: route_name,
            size_mask_diff: route_size_mask_diff[subnet_routes[route_name].size],
        });
    }
    const sorted_routes = routes.sort((x, y) => x.size_mask_diff - y.size_mask_diff);
    const subnet_cnt = sorted_routes.length;
    const subnet_mask = Cidr.mask(cidr) + log2ceil(subnet_cnt);

    let avail_cidr: string | null = cidr;
    let subnets = [];
    let freeCidrs = [];

    for (let route of sorted_routes) {
        const subnet_cidr = Cidr.subnets(avail_cidr, subnet_mask + route.size_mask_diff)[0];
        subnets.push(new Subnet(
            provider,
            subnet_cidr,
            route.name,
        ));

        avail_cidr = cidrSubtract(avail_cidr, subnet_cidr);
        if (avail_cidr === null) {
            break
        }
    }

    if (avail_cidr !== null) {
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
    subnets: Array<Subnet>;
    freeCidrs: Array<FreeCidr>;

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

        const re = planZone(provider, cidr, subnet_routes);
        this.subnets = re.subnets;
        this.freeCidrs = re.freeCidrs;
    }

    toJSON(): Object {
        let zone = {
            name: this.name,
            zone: this.zone,
            cidr: this.cidr,
            subnets: [] as Array<Object>,
            reserved_cidrs: [] as Array<Object>,
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
    zones: Array<Zone>;
    freeCidrs: Array<FreeCidr>;
}

function planVPC(provider: string, cidr: string, region: string, zone_count: number, subnet_routes: SubnetRoutes): VPCPlanResult {
    const zone_mask = Cidr.mask(cidr) + log2ceil(zone_count);

    let zones = [];
    let freeCidrs = [];

    let idx = 0;
    for (let zone_cidr of Cidr.subnets(cidr, zone_mask)) {
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
    zones: Array<Zone>;
    freeCidrs: Array<FreeCidr>;

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

    toJSON(): any {
        let vpc = {
            name: this.name,
            region: this.region,
            cidr: this.cidr,
            zones: [] as Array<Object>,
            reserved_cidrs: [] as Array<Object>,
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
    vpcs: Array<VPC>;
    freeCidrs: Array<FreeCidr>;
}

function planCluster(provider: string, cidr: string, regions: RegionsConfig, subnet_routes: SubnetRoutes): ClusterPlanResult {
    const region_names = Object.keys(regions);
    const region_cnt = region_names.length;
    const region_mask = Cidr.mask(cidr) + log2ceil(region_cnt);
    let vpcs = [];
    let freeCidrs = [];

    let idx = 0;
    const region_cidrs = Cidr.subnets(cidr, region_mask);
    for (let region_cidr of region_cidrs) {
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
    vpcs: Array<VPC>;
    freeCidrs: Array<FreeCidr>;

    constructor(
        provider: string, cidr: string, regions: RegionsConfig, subnet_routes: SubnetRoutes,
    ) {
        this.cidr = cidr;
        this.regions = regions;
        this.subnet_routes = subnet_routes;
        this.provider = provider;

        this.ip_count = Cidr.count(cidr);
        const re = planCluster(provider, cidr, regions, subnet_routes);
        this.vpcs = re.vpcs;
        this.freeCidrs = re.freeCidrs;
    }
}
