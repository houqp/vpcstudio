interface NodePosition {
    x: number;
    y: number;
}

interface NodeDimen {
    w: number;
    h: number;
}

function GridLayout(options: object): void {
    this.options = options;
}

GridLayout.prototype.run = function(): object {
    const options = this.options;
    const cy = options.cy;

    // node dimension indexed by node.id()
    const nodeDimen: {[index: string]: NodeDimen} = {};
    // node position indexed by node.id()
    const nodePos: {[index: string]: NodePosition} = {};

    // first pass to calculate node dimensions
    const padding = 10;
    const margin = 40;

    const vpc_nodes = cy.nodes("[kind = 'vpc']");
    for (const vpc of vpc_nodes) {
        let w = padding;
        let h = 2 * padding;
        let max_zone_height = 0;

        const zones = vpc.children();
        for (const zone of zones) {
            const zone_id = zone.id();
            // calculate zone dimension based of subnet dimension
            let zw = 2 * padding;
            let zh = padding;
            let max_width = 0;
            const subnets = zone.children();
            for (const subnet of subnets) {
                const dimen = subnet.layoutDimensions({
                    nodeDimensionsIncludeLabels: true,
                });
                nodeDimen[subnet.id()] = dimen;
                if (dimen.w > max_width) {
                    max_width = dimen.w;
                }
                zh += dimen.h + padding;
            }
            zw += max_width;

            const zone_dimen = {w: zw, h: zh,};
            nodeDimen[zone_id] = zone_dimen;

            if (zone_dimen.h > max_zone_height) {
                max_zone_height = zone_dimen.h;
            }
            w += zone_dimen.w + padding;
        }

        h += max_zone_height + padding * 2;
        nodeDimen[vpc.id()] = {w: w, h: h,};
    }

    // second pass to position subnet nodes
    // NOTE: A compound parent node does not have independent dimensions
    // (position and size), as those values are automatically inferred by the
    // positions and dimensions of the descendant nodes.
    let y = 0;
    for (const vpc of vpc_nodes) {
        const vpc_id = vpc.id();
        let x = padding;
        nodePos[vpc_id] = {x: x, y: y};

        for (const zone of vpc.children()) {
            let ys = y;
            for (const subnet of zone.children()) {
                const subnet_id = subnet.id();
                nodePos[subnet_id] = {x: x, y: ys};
                ys += nodeDimen[subnet_id].h + padding;
            }

            const zone_id = zone.id();
            nodePos[zone_id] = {x: x, y: y};
            x += nodeDimen[zone_id].w + padding;
        }

        const vpc_label_height = vpc.layoutDimensions({
            nodeDimensionsIncludeLabels: true,
        }).h - vpc.layoutDimensions({}).h
        y += nodeDimen[vpc_id].h + vpc_label_height + margin;
    }


    // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
    cy.nodes().layoutPositions(this, options, function(node: any, i: number) {
        const id = node.id();
        let pos = nodePos[id];
        if (!pos) {
            pos = { x: 0, y: 0, };
        }
        return pos;
    });

    return this; // chaining
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const GridLayoutReg = function(cytoscape: any): void {
    if (!cytoscape) { return ; }
    cytoscape("layout", "vpc", GridLayout);
};

export default GridLayoutReg;
