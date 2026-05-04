"""
[PROTOCOL]:

1. 逻辑变更后更新此 Header

2. 更新后检查所属 `.folder.md`

课程：北京大学《数据结构与算法Python版》
来源：https://blog.csdn.net/qq_45347185/article/details/118528594
章节：第六周 递归-下
题目：铺瓷砖

题意：用长度 1、2、3、4 的瓷砖铺满长度为 N 的区域，求不同铺法数。
输入：自然数 N。
输出：铺法总数。
"""


def solve():
    n = int(input())
    ways = [0] * (n + 1)
    ways[0] = 1
    for length in range(1, n + 1):
        ways[length] = sum(ways[length - tile] for tile in (1, 2, 3, 4) if length >= tile)
    print(ways[n])


if __name__ == "__main__":
    solve()
