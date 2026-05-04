"""
[PROTOCOL]:

1. 逻辑变更后更新此 Header

2. 更新后检查所属 `.folder.md`

课程：北京大学《数据结构与算法Python版》
来源：https://blog.csdn.net/qq_45347185/article/details/118527284
章节：第五周 递归-上
题目：四柱汉诺塔

题意：给定盘数和 4 根柱子，求完成迁移的最小步数。
输入：非负整数 M，M <= 1000。
输出：最小步数。
"""


def solve():
    m = int(input())
    dp = [0] * (m + 1)
    for n in range(1, m + 1):
        dp[n] = min(2 * dp[n - r] + 2**r - 1 for r in range(1, n + 1))
    print(dp[m])


if __name__ == "__main__":
    solve()
