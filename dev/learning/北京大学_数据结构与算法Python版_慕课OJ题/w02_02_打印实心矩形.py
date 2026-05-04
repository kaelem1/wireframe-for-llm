"""
[PROTOCOL]:

1. 逻辑变更后更新此 Header

2. 更新后检查所属 `.folder.md`

课程：北京大学《数据结构与算法Python版》
来源：https://blog.csdn.net/qq_45347185/article/details/118101633
章节：第二周 算法分析
题目：打印实心矩形

题意：给出行数和列数，打印由星号组成的实心矩形。
输入：一行，两个整数 m n。
输出：m 行 n 列星号。
"""


def solve():
    m, n = map(int, input().split())
    for _ in range(m):
        print("*" * n)


if __name__ == "__main__":
    solve()
