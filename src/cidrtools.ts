export const posToIp = (pos: number): string => {
    const parts = [];
    parts.push(pos % 256);
    pos = Math.floor(pos / 256);
    parts.push(pos % 256);
    pos = Math.floor(pos / 256);
    parts.push(pos % 256);
    pos = Math.floor(pos / 256);
    parts.push(pos % 256);
    return `${parts[3]}.${parts[2]}.${parts[1]}.${parts[0]}`;
};

export const ipToPos = (ip: string): number => {
    const addr_parts = ip.split(".");
    return parseInt(addr_parts[0]) * 256**3
        + parseInt(addr_parts[1]) * 256**2
        + parseInt(addr_parts[2]) * 256
        + parseInt(addr_parts[3]);
}

export function cidrToRange(cidr: string): number[] {
    const [addr_str, mask_str] = cidr.split("/");
    const minIdx = ipToPos(addr_str);

    const mask = parseInt(mask_str);
    const maxIdx = minIdx + 2 ** (32 - mask) - 1;

    return [minIdx, maxIdx];
}

export const cidrMask = (cidr: string): number => {
    const mask_str = cidr.split("/")[1];
    return parseInt(mask_str);
}

export const cidrAddr = (cidr: string): string => {
    return cidr.split("/")[0];
}

const cidrMinPos = (cidr: string): number => {
    return cidrToRange(cidr)[0];
}

const cidrMaxPos = (cidr: string): number => {
    return cidrToRange(cidr)[1];
}

export const cidrCountIps = (cidr: string): number => {
    const [min, max] = cidrToRange(cidr);
    return max-min+1;
};

export const cidrSubnets = (cidr: string, new_mask: number): string[] => {
    const [addr, mask] = cidr.split("/");
    let currPos = ipToPos(addr);

    const mask_diff = new_mask - parseInt(mask);
    const subnet_count = 2 ** mask_diff;
    const subnet_size = 2 ** (32-new_mask);
    const cidrs = [];

    for (let i = 0; i < subnet_count; i++) {
        cidrs.push(`${posToIp(currPos)}/${new_mask}`);
        currPos += subnet_size;
    }

    return cidrs;
};

const cidrMinIp = (cidr: string): string => {
    return posToIp(cidrMinPos(cidr));
}

const cidrMaxIp = (cidr: string): string => {
    return posToIp(cidrMaxPos(cidr));
}

export const rangeToCidrs = (min: number, max: number): string[] => {
    if (min > max) {
        console.error("got invalid range for cidr conversion", min, max);
        return [];
    }

    let mask = 0;
    let baseIp = min;
    let ip_counts = max - min;

    const cidrs = [];

    while (ip_counts > 0) {
        let found_cidr = false;
        for (let i = 0; i <= 32; i++) {
            mask = 32 - i;
            const exp = 2 ** (32 - mask);
            if (exp - 1 === ip_counts) {
                // found the perfect match
                cidrs.push(`${posToIp(baseIp)}/${mask}`);
                ip_counts = 0;
                found_cidr = true;
                break;
            } else if (exp - 1 > ip_counts) {
                // can't find a perfect mask to match remaining range
                // mask is a superset of remaining range
                // mask+1 covers part of remianing range
                // use mask+1 and recursively find a prefect match for what's left over
                //
                // mask      mask+1
                //   |----------|-------|---|
                //   baseIp       baseIp+ip_counts

                mask += 1;
                const sub_cidr = `${posToIp(baseIp)}/${mask}`;
                cidrs.push(sub_cidr);

                const sub_cidr_max = cidrToRange(sub_cidr)[1];
                const new_min = sub_cidr_max + 1;
                baseIp = new_min;
                ip_counts = max - new_min;
                found_cidr = true;
                break;
            }
        }
        if (!found_cidr) {
            console.error("not able to find cidr range for range", min, max);
            break;
        }
    }

    return cidrs;
}

export class CidrBlock {
    // input
    cidr: string;
    // output
    ip_count: number;
    ip_start: string;
    ip_end: string;

    constructor(cidr: string) {
        this.cidr = cidr;
        this.ip_count = cidrCountIps(cidr);
        this.ip_start = cidrMinIp(cidr);
        this.ip_end = cidrMaxIp(cidr);
    }
}

export class IpSet {
    cidrs: string[];

    constructor(cidrs: string[]) {
        this.cidrs = cidrs;
        this.cidrs.sort((a, b) => {
            const a_minpos = cidrToRange(a)[0];
            const b_minpos = cidrToRange(b)[0];
            return a_minpos - b_minpos;
        });
    }

    nextCidr(mask: number): string {
        return cidrSubnets(this.cidrs[0], mask)[0];
    }

    subtract(to_cidr: string): void {
        // 1. find the right superset cidr
        let i: number;
        let from_cidr: string | null = null;
        const [ymin, ymax] = cidrToRange(to_cidr);
        // find superset cidr that contains to_cidr
        for (i = 0; i < this.cidrs.length; i++) {
            const cidr = this.cidrs[i];
            const [xmin, xmax] = cidrToRange(cidr);
            if ((xmin <= ymin) && (xmax >= ymax)) {
                from_cidr = cidr
                break
            }
        }
        if (from_cidr === null) {
            console.error("cidr to substract not within ipset", to_cidr, this.cidrs);
            return;
        }

        this.cidrs.splice(i, 1);  // remove from cidr list

        // 2. subtract to_cidr from from_cidr
        //    if there is any free address left, put them back into this.cidrs
        const [xmin, xmax] = cidrToRange(from_cidr);

        let new_min: number;
        let new_max: number;
        if (xmin === ymin) {
            new_min = ymax+1;
            new_max = xmax;
        } else if (xmax === ymax) {
            new_min = xmin;
            new_max = ymin-1;
        } else {
            // ycidr needs to be either a prefix or suffix of xcidr
            console.error("no overlap between cidr ranges", xmin, xmax, ymin, ymax);
            return;
        }

        if (new_min > new_max) {
            // this should never happen
            console.error("invalid range for remaining cidr", new_min, new_max);
            return;
        } else if (new_min == new_max) {
            // from_cidr has been fully consumed
            return;
        }

        // 3. add remaining cidrs to cidr list
        const remaining_cidrs = rangeToCidrs(new_min, new_max);
        for (const cidr of remaining_cidrs) {
            this.addCidr(cidr);
        }
    }

    // insert cidr into current cidr list ordered by range
    // merge cidrs if applicable
    addCidr(cidr: string): void {
        const maxip = cidrToRange(cidr)[1];
        let i = 0;
        for (i=0; i < this.cidrs.length; i++) {
            const curr_minip = cidrToRange(this.cidrs[i])[0];
            // cidr[i] has a range after cidr
            if (curr_minip >= maxip) {
                break;
            }
        }
        this.cidrs.splice(i, 0, cidr);

        // look for cidrs to merge
        if (this.cidrs.length <= 1) {
            return;
        }
        const ip_ranges = [];
        for (const cidr of this.cidrs) {
            ip_ranges.push(cidrToRange(cidr));
        }

        i = 0;
        while (i < ip_ranges.length-1) {
            const [curr_minip, curr_maxip] = ip_ranges[i];
            const [next_minip, next_maxip] = ip_ranges[i+1];
            if (curr_maxip+1 == next_minip) {
                ip_ranges.splice(i, 2);
                ip_ranges.splice(i, 0, [curr_minip, next_maxip]);
            } else {
                i++;
            }
        }
        // if range count remians the same, then no merge needed
        if (ip_ranges.length >= this.cidrs.length) {
            return;
        }
        // rebuild this.cidr based off new ranges
        this.cidrs = [];
        for (const range of ip_ranges) {
            this.cidrs = this.cidrs.concat(rangeToCidrs(range[0], range[1]));
        }
    }

    ipCount(): number {
        let cnt = 0;
        for (const cidr of this.cidrs) {
            cnt += cidrCountIps(cidr);
        }
        return cnt
    }

    getCidrs(): string[] {
        return this.cidrs;
    }
}
