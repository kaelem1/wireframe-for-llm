"""
[PROTOCOL]:

1. 逻辑变更后更新此 Header

2. 更新后检查所属 `.folder.md`

课程：北京大学《数据结构与算法Python版》
来源：https://blog.csdn.net/qq_45347185/article/details/118101633
章节：第二周 算法分析
题目：A/B问题

题意：输入两个整数，输出它们的商；除数为 0 时输出 NA。
输入：两行，每行一个整数。
输出：商，保留小数点后 3 位；或 NA。
"""


def solve():
    a = int(input())
    b = int(input())
    if b == 0:
        print("NA")
    else:
        print("%.3f" % (a / b))


if __name__ == "__main__":
    solve()
