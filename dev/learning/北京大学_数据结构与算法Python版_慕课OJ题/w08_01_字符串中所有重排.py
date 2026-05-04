"""
[PROTOCOL]:

1. 逻辑变更后更新此 Header

2. 更新后检查所属 `.folder.md`

课程：北京大学《数据结构与算法Python版》
来源：https://blog.csdn.net/qq_45347185/article/details/118532103
章节：第八周 排序与查找-下
题目：字符串中所有重排

题意：找出 s 中所有长度为 len(p)、且是 p 字母重排的子串下标。
输入：第一行 s；第二行 p。
输出：下标递增并以空格分隔；无结果输出 none。
"""


def solve():
    s = input().strip()
    p = input().strip()
    need = [0] * 26
    window = [0] * 26
    for ch in p:
        need[ord(ch) - ord("a")] += 1
    result = []
    for i, ch in enumerate(s):
        window[ord(ch) - ord("a")] += 1
        if i >= len(p):
            window[ord(s[i - len(p)]) - ord("a")] -= 1
        if i >= len(p) - 1 and window == need:
            result.append(i - len(p) + 1)
    print(" ".join(map(str, result)) if result else "none")


if __name__ == "__main__":
    solve()
