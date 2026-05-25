interface TrieNode {
  readonly children: Map<string, TrieNode>;
  isTerminal: boolean;
}

function createNode(): TrieNode {
  return { children: new Map(), isTerminal: false };
}

export class PermissionTrie {
  private readonly root: TrieNode = createNode();

  insert(permission: string): void {
    const segments = permission.split(':');
    let current = this.root;

    for (const segment of segments) {
      let child = current.children.get(segment);
      if (!child) {
        child = createNode();
        current.children.set(segment, child);
      }
      current = child;
    }

    current.isTerminal = true;
  }

  has(permission: string): boolean {
    const segments = permission.split(':');
    return this.match(this.root, segments, 0);
  }

  toArray(): string[] {
    const results: string[] = [];
    this.collect(this.root, [], results);
    return results;
  }

  static fromPermissions(permissions: readonly string[]): PermissionTrie {
    const trie = new PermissionTrie();
    for (const perm of permissions) {
      trie.insert(perm);
    }
    return trie;
  }

  private match(node: TrieNode, segments: string[], index: number): boolean {
    // Check wildcard at this level — "*" matches all remaining segments
    const wildcard = node.children.get('*');
    if (wildcard?.isTerminal) {
      return true;
    }

    if (index === segments.length) {
      return node.isTerminal;
    }

    const segment = segments.at(index);
    if (segment === undefined) {
      return node.isTerminal;
    }

    // Check exact match
    const exact = node.children.get(segment);
    if (exact && this.match(exact, segments, index + 1)) {
      return true;
    }

    // Check wildcard match — descend into "*" node
    if (wildcard && this.match(wildcard, segments, index + 1)) {
      return true;
    }

    return false;
  }

  private collect(node: TrieNode, path: readonly string[], results: string[]): void {
    if (node.isTerminal) {
      results.push(path.join(':'));
    }

    for (const [segment, child] of node.children) {
      this.collect(child, [...path, segment], results);
    }
  }
}
