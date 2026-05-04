"""
[PROTOCOL]:

1. 逻辑变更后更新此 Header

2. 更新后检查所属 `.folder.md`

课程：北京大学《数据结构与算法Python版》
来源：https://blog.csdn.net/qq_45347185/article/details/118527284
章节：第五周 递归-上
题目：ASCII谢尔宾斯基地毯

题意：给定 3 的正整数幂 N 和组成元素字符串，打印谢尔宾斯基地毯。
输入：第一行 N；第二行字符元素 c。
输出：N 行，每行长度 N * len(c)。
"""


def filled(row, col):
    while row or col:
        if row % 3 == 1 and col % 3 == 1:
            return False
        row //= 3
        col //= 3
    return True


def solve():
    n = int(input())
    char = input()
    blank = " " * len(char)
    for row in range(n):
        print("".join(char if filled(row, col) else blank for col in range(n)))


if __name__ == "__main__":
    solve()
