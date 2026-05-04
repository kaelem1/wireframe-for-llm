"""
[PROTOCOL]:

1. 逻辑变更后更新此 Header

2. 更新后检查所属 `.folder.md`

课程：北京大学《数据结构与算法Python版》
来源：https://blog.csdn.net/qq_45347185/article/details/118559456
章节：第九周 树及算法-上
题目：二叉树复原

题意：按给定层次序列化列表复原二叉树，并输出中序遍历。
实现：按队列逐个消费左右孩子位置，None 不再扩展子节点。
输入：合法 Python 列表表达式，元素为整数或 None。
输出：中序遍历整数序列，以空格分隔。
"""


class Node:
    def __init__(self, value):
        self.value = value
        self.left = None
        self.right = None


def inorder(node, result):
    if node is None:
        return
    inorder(node.left, result)
    result.append(node.value)
    inorder(node.right, result)


def solve():
    seq = eval(input())
    if not seq:
        print("")
        return
    root = Node(seq[0])
    queue = [root]
    index = 1
    while index < len(seq) and queue:
        node = queue.pop(0)
        if index < len(seq) and seq[index] is not None:
            node.left = Node(seq[index])
            queue.append(node.left)
        index += 1
        if index < len(seq) and seq[index] is not None:
            node.right = Node(seq[index])
            queue.append(node.right)
        index += 1
    result = []
    inorder(root, result)
    print(" ".join(map(str, result)))


if __name__ == "__main__":
    solve()
