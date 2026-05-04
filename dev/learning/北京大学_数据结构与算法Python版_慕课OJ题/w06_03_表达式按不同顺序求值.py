"""
[PROTOCOL]:

1. 逻辑变更后更新此 Header

2. 更新后检查所属 `.folder.md`

课程：北京大学《数据结构与算法Python版》
来源：https://blog.csdn.net/qq_45347185/article/details/118528594
章节：第六周 递归-下
题目：表达式按不同顺序求值

题意：给定只含数字和 +、-、* 的表达式，求不同计算顺序得到的全部不重复结果。
实现：读取时去掉空格后递归枚举运算符左右子表达式。
输入：一行表达式字符串。
输出：结果从小到大排序，以半角逗号分隔。
"""


def compute(expr):
    results = []
    for i, ch in enumerate(expr):
        if ch in "+-*":
            for left in compute(expr[:i]):
                for right in compute(expr[i + 1:]):
                    if ch == "+":
                        results.append(left + right)
                    elif ch == "-":
                        results.append(left - right)
                    else:
                        results.append(left * right)
    return results if results else [int(expr)]


def solve():
    results = sorted(set(compute(input().replace(" ", "").strip())))
    print(",".join(map(str, results)))


if __name__ == "__main__":
    solve()
