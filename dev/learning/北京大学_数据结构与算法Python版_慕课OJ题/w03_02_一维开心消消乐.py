"""
[PROTOCOL]:

1. 逻辑变更后更新此 Header

2. 更新后检查所属 `.folder.md`

课程：北京大学《数据结构与算法Python版》
来源：https://blog.csdn.net/qq_45347185/article/details/118103239
章节：第三周 基本线性结构
题目：一维开心消消乐

题意：逐个消去相邻且相同的字符对，若全部消完输出 None。
输入：一个字符串。
输出：消去后的字符串，或 None。
"""


def solve():
    stack = []
    for ch in input():
        if stack and stack[-1] == ch:
            stack.pop()
        else:
            stack.append(ch)
    print("".join(stack) if stack else "None")


if __name__ == "__main__":
    solve()
