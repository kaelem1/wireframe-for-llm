"""
[PROTOCOL]:

1. 逻辑变更后更新此 Header

2. 更新后检查所属 `.folder.md`

课程：北京大学《数据结构与算法Python版》
来源：https://blog.csdn.net/qq_45347185/article/details/118531686
章节：第七周 排序与查找-上
题目：第一个坏版本

题意：给定版本总数与 isBadVersion 判断函数，找第一个损坏版本。
输入：第一行 N；第二行为可 eval 的判断函数。
输出：第一个坏版本编号。
"""


def solve():
    n = int(input())
    is_bad_version = eval(input())
    left, right = 1, n
    while left < right:
        mid = (left + right) // 2
        if is_bad_version(mid):
            right = mid
        else:
            left = mid + 1
    print(left)


if __name__ == "__main__":
    solve()
