"""
[PROTOCOL]:

1. 逻辑变更后更新此 Header

2. 更新后检查所属 `.folder.md`

课程：北京大学《数据结构与算法Python版》
来源：https://blog.csdn.net/qq_45347185/article/details/118103239
章节：第三周 基本线性结构
题目：有效的括号

题意：判断只含括号字符的字符串是否合法匹配。
输入：一行字符串。
输出：True 或 False。
"""


def solve():
    pairs = {")": "(", "]": "[", "}": "{"}
    stack = []
    for ch in input():
        if ch in "([{":
            stack.append(ch)
        elif not stack or stack.pop() != pairs[ch]:
            print(False)
            return
    print(not stack)


if __name__ == "__main__":
    solve()
