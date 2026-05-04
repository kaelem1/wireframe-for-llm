"""
[PROTOCOL]:

1. 逻辑变更后更新此 Header

2. 更新后检查所属 `.folder.md`

课程：北京大学《数据结构与算法Python版》
来源：https://blog.csdn.net/qq_45347185/article/details/118527284
章节：第五周 递归-上
题目：进制转换

题意：把 M 进制数转换为 N 进制输出，2 <= M,N <= 36。
输入：第一行 M N；第二行待转换的 M 进制数。
输出：N 进制表示。
"""


DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"


def solve():
    source_base, target_base = map(int, input().split())
    raw = input().strip()
    value = 0
    for ch in raw:
        value = value * source_base + DIGITS.index(ch)
    if value == 0:
        print("0")
        return
    result = []
    while value:
        value, remainder = divmod(value, target_base)
        result.append(DIGITS[remainder])
    print("".join(reversed(result)))


if __name__ == "__main__":
    solve()
