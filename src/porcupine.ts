type ItNode = {
	name: string;
	passed: boolean;
};

type DescribeNode = {
	name: string;
	children: Array<DescribeNode | ItNode>;
};

type DescribeNodeWithResults = {
	name: string;
	children: Array<DescribeNodeWithResults | ItNode>;
	numPassed: number;
	numTotal: number;
};

/**
 * @todo Type checking for DescribeNode
 */
function getNodeFromEnvironment(): DescribeNode | undefined {
	const environment = getfenv(1);
	if ("node" in environment) {
		return environment.node as DescribeNode;
	} else {
		return undefined;
	}
}

function clearNodeFromEnvironment() {
	const environment = getfenv(1);
	if ("node" in environment) {
		environment.node = undefined;
	}
}

function setNodeInEnvironment(node: DescribeNode) {
	const environment = getfenv(1) as { script: LuaSourceContainer; node: DescribeNode };
	environment.node = node;
}

function tabStats(nodes: DescribeNode[]): DescribeNodeWithResults[] {
	function c(node: DescribeNode): DescribeNodeWithResults {
		const r = node.children.reduce<{
			numPassed: number;
			numTotal: number;
			children: (DescribeNodeWithResults | ItNode)[];
		}>(
			(acc, curChild) => {
				if ("children" in curChild) {
					const res = c(curChild);
					acc.children.push(res);
					return {
						numPassed: acc.numPassed + res.numPassed,
						numTotal: acc.numTotal + res.numTotal,
						children: acc.children,
					};
				} else {
					acc.children.push(curChild);
					return {
						numPassed: acc.numPassed + (curChild.passed ? 1 : 0),
						numTotal: acc.numTotal + 1,
						children: acc.children,
					};
				}
			},
			{ numPassed: 0, numTotal: 0, children: [] },
		);

		return {
			name: node.name,
			children: r.children,
			numPassed: r.numPassed,
			numTotal: r.numTotal,
		};
	}

	return nodes.map(c);
}

function prettyPrint(nodes: DescribeNodeWithResults[]) {
	function c(node: DescribeNodeWithResults, level: number) {
		print(`${string.rep(" ", level)} ${node.name} (${node.numPassed}/${node.numTotal})`);
		node.children.forEach((node) => {
			if ("children" in node) {
				c(node, level + 1);
			} else {
				print(`${string.rep(" ", level + 1)} ${node.name} passed = ${node.passed}`);
			}
		});
	}

	nodes.forEach((node) => c(node, 0));
}

export function it(name: string, f: () => void) {
	const [success, _] = pcall(f);

	const node: ItNode = { name: name, passed: success };

	const parentNode = getNodeFromEnvironment();

	if (parentNode) {
		parentNode.children.push(node);
	} else {
		error(`\`it\` needs to be run inside of a \`describe\` call!`);
	}
}

export function describe(name: string, f: () => void) {
	const node: DescribeNode = {
		name: name,
		children: [],
	};

	const parentNode = getNodeFromEnvironment();
	setNodeInEnvironment(node);

	f();

	if (parentNode) {
		parentNode.children.push(node);
		setNodeInEnvironment(parentNode);
	}
}

export function RunTests(functions: Array<() => void>) {
	const resultArray: DescribeNode[] = [];

	for (const f of functions) {
		f();
		const environment = getfenv(1);
		if ("node" in environment) {
			resultArray.push(environment.node as DescribeNode);
			environment.node = undefined;
		} else {
			error(`Could not find \`node \` in the environment list!`);
		}
	}

	const stats = tabStats(resultArray);
	prettyPrint(stats);
}
