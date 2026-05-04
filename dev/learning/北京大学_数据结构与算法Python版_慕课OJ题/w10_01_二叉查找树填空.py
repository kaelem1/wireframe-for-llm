"""
[PROTOCOL]:

1. 逻辑变更后更新此 Header

2. 更新后检查所属 `.folder.md`

课程：北京大学《数据结构与算法Python版》
来源：https://blog.csdn.net/qq_45347185/article/details/118579643
章节：第十周 树及算法-下
题目：二叉查找树填空

题意：给定二叉树结构和整数列表，把整数填入节点使其成为二叉查找树，并输出层次遍历。
实现：中序赋值后按树结构层次遍历输出，而非按节点编号输出。
输入：N；随后 N 行左右子树编号；最后一行 N 个整数。
输出：填值后二叉查找树层次遍历。
"""


def inorder(index, children, order):
    if index == -1:
        return
    inorder(children[index][0], children, order)
    order.append(index)
    inorder(children[index][1], children, order)


def solve():
    n = int(input())
    children = [tuple(map(int, input().split())) for _ in range(n)]
    values = sorted(map(int, input().split()))
    order = []
    inorder(0, children, order)
    assigned = [0] * n
    for index, value in zip(order, values):
        assigned[index] = value
    queue = [0]
    level_values = []
    while queue:
        index = queue.pop(0)
        level_values.append(assigned[index])
        left, right = children[index]
        if left != -1:
            queue.append(left)
        if right != -1:
            queue.append(right)
    print(" ".join(map(str, level_values)))


if __name__ == "__main__":
    solve()
