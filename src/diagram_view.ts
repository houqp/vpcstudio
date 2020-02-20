import cytoscape from "cytoscape";
import vpcLayout from './cytoscape-vpc';
import noOverlap from 'cytoscape-no-overlap';
import popper from 'cytoscape-popper';

import {
    Cluster,
} from "./planner";

cytoscape.use(noOverlap);
cytoscape.use(popper);
cytoscape.use(vpcLayout);

interface Popper {
    scheduleUpdate(): void;
    update(): void;
    destroy(): void;
}

function drawDiagram(cluster: Cluster, clearCallbacks: (() => void)[]): void {
    const elements = [];

    for (const vpc of cluster.vpcs) {
        const vpc_id = vpc.name;

        elements.push({
            data: {
                id: vpc_id,
                label: `${vpc.name} @ ${vpc.region} (${vpc.cidr})`,
                desc: `VPC <b>${vpc.name}</b> in region <b>${vpc.region}</b>`,
                kind: "vpc",
                obj: vpc,
            },
        });

        for (const zone of vpc.zones) {
            const zone_id = `${vpc.name}::${zone.name}`;
            elements.push({
                data: {
                    id: zone_id,
                    label: `${zone.name} (${zone.cidr})`,
                    desc: `Zone <b>${zone.zone}</b>`,
                    parent: vpc_id,
                    kind: "zone",
                    obj: zone,
                },
            });

            for (const subnet of zone.subnets) {
                const subnet_id = `${zone_id}::${subnet.name}`
                elements.push({
                    data: {
                        id: subnet_id,
                        label: subnet.name + "\n" + subnet.cidr,
                        desc: `Subnet <b>${subnet.name}</b> in zone <b>${zone.zone}</b>`,
                        parent: zone_id,
                        kind: "subnet",
                        obj: subnet,
                    },
                });
            }

            for (const freecidr of zone.freeCidrs) {
                elements.push({
                    data: {
                        id: `reserved::${freecidr.cidr}`,
                        label: `reserved CIDR\n${freecidr.cidr})`,
                        desc: `Reserved CIDR for future subnets in zone <b>${zone.zone}</b>`,
                        parent: zone_id,
                        kind: "subnet",
                        obj: freecidr,
                        reserved: true,
                    },
                });
            }
        }

        for (const freecidr of vpc.freeCidrs) {
            elements.push({
                data: {
                    id: `reserved::${freecidr.cidr}`,
                    label: `reserved CIDR\n${freecidr.cidr})`,
                    desc: `Reserved CIDR for future zones in region <b>${vpc.region}</b>`,
                    parent: vpc_id,
                    reserved: true,
                    kind: "zone",
                    obj: freecidr,
                },
            });
        }
    }

    for (const freecidr of cluster.freeCidrs) {
        elements.push({
            data: {
                id: `reserved::${freecidr.cidr}`,
                label: `reserved CIDR\n${freecidr.cidr})`,
                desc: `Reserved CIDR for future VPCs`,
                kind: "vpc",
                obj: freecidr,
                reserved: true,
            },
        });
    }

    const diagramDiv = document.getElementById("diagram") as HTMLDivElement;
    const cy = cytoscape({
        container: diagramDiv,
        elements: elements,
        style: [ // the stylesheet for the graph
          {
            selector: 'node',
            style: {
              'text-wrap': 'wrap',
              'text-valign': 'center',
              'text-halign': 'center',
              'color': '#525f7f',

              'padding-top': '10px',
              'padding-left': '10px',
              'padding-right': '10px',
              'padding-bottom': '10px',

              'shape': 'rectangle',
              'width': 'label',
              'height': 'label',
              'label': 'data(label)',
            },
          },
          {
            selector: '$node > node',
            style: {
              'text-valign': 'top',
              'text-halign': 'center',
            },
          },

          {
            selector: "[kind = 'subnet']",
            style: {
              'background-color': '#fff',
            },
          },

          {
            selector: "[kind = 'zone']",
            style: {
              'background-color': '#E1F6F1',
            },
          },

          {
            selector: "[kind = 'vpc']",
            style: {
              'background-color': '#f5f5ee',
            },
          },

          {
            selector: "[?reserved]",
            style: {
              'color': '#AAA',
              'background-color': '#fff',
              'border-width': '1px',
              'border-style': 'dashed',
              'border-color': '#ccc',
            },
          },

          {
            selector: 'edge',
            style: {
              'width': 3,
              'line-color': '#ccc',
              'target-arrow-color': '#ccc',
              'target-arrow-shape': 'triangle'
            }
          }
        ],
        layout: {
            name: "vpc",
            fit: true,
        },
    });

    cy.nodes().noOverlap({ padding: 5 });

    let details_popper: Popper|null = null;

    const closePopper = (): void => {
        if (details_popper !== null) {
            details_popper.destroy();
            details_popper = null;
        }
    };
    clearCallbacks.push(closePopper);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cy.on("click", function(event: any) {
        closePopper();

        if (event.target == null || event.target.length !== 1) {
            return
        }

        const node = event.target;
        const data = event.target.data();

        details_popper = node.popper({
            content: () => {
                const div = document.createElement('div');
                div.innerHTML = `
                    <div id="diagram-popper" class="box">

                      <div class="field is-horizontal">
                        <div class="field-label">
                          <label class="label">Type</label>
                        </div>
                        <div class="field-body">
                          <div class="field">${data.kind}</div>
                        </div>
                      </div>

                      <div class="field is-horizontal">
                        <div class="field-label">
                          <label class="label">Desc</label>
                        </div>
                        <div class="field-body">
                          <div class="field">${data.desc}</div>
                        </div>
                      </div>

                      <div class="field is-horizontal">
                        <div class="field-label">
                          <label class="label">CIDR</label>
                        </div>
                        <div class="field-body">
                          <div class="field">${data.obj.cidr}</div>
                        </div>
                      </div>

                      <div class="field is-horizontal">
                        <div class="field-label">
                          <label class="label">Start IP</label>
                        </div>
                        <div class="field-body">
                          <div class="field">${data.obj.ip_start}</div>
                        </div>
                      </div>

                      <div class="field is-horizontal">
                        <div class="field-label">
                          <label class="label">End IP</label>
                        </div>
                        <div class="field-body">
                          <div class="field">${data.obj.ip_end}</div>
                        </div>
                      </div>

                      <div class="field is-horizontal">
                        <div class="field-label">
                          <label class="label">IP count</label>
                        </div>
                        <div class="field-body">
                          <div class="field">${data.obj.ip_count}</div>
                        </div>
                      </div>

                    </div>
                `;
                document.body.appendChild(div);
                return div;
            },
            popper: {
                removeOnDestroy: true,
            },
        }) as Popper;

        const updatePopper = (): void => {
            if (details_popper !== null) {
                details_popper.scheduleUpdate();
            }
        };

        cy.on('position pan zoom resize', updatePopper);
    });
}

export default drawDiagram;
