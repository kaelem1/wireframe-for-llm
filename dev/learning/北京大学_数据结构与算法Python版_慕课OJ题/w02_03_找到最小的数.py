"""
[PROTOCOL]:

1. 逻辑变更后更新此 Header

2. 更新后检查所属 `.folder.md`

课程：北京大学《数据结构与算法Python版》
来源：https://blog.csdn.net/qq_45347185/article/details/118101633
章节：第二周 算法分析
题目：找到最小的数

题意：给定若干整数，输出其中最小值。
输入：一行，空格分隔的一系列整数，数量不少于 2。
输出：最小整数。
"""


def solve():
    nums = list(map(int, input().split()))
    print(min(nums))


if __name__ == "__main__":
    solve()
