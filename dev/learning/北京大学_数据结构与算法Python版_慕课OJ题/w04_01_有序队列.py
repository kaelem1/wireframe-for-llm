"""
[PROTOCOL]:

1. 逻辑变更后更新此 Header

2. 更新后检查所属 `.folder.md`

课程：北京大学《数据结构与算法Python版》
来源：https://blog.csdn.net/qq_45347185/article/details/118526844
章节：第四周 基本线性结构-下
题目：有序队列

题意：字符串可反复把最左字符移到末尾，求所有旋转结果中字典序最小者。
实现：Booth 算法求最小表示，避免全量旋转比较。
输入：仅含小写字母的字符串 S，长度不超过 100000。
输出：与 S 等长的最小旋转字符串。
"""


def solve():
    s = input().strip()
    if not s:
        print("")
        return
    doubled = s * 2
    length = len(s)
    i, j, k = 0, 1, 0
    while i < length and j < length and k < length:
        left = doubled[i + k]
        right = doubled[j + k]
        if left == right:
            k += 1
        elif left > right:
            i += k + 1
            if i == j:
                i += 1
            k = 0
        else:
            j += k + 1
            if i == j:
                j += 1
            k = 0
    start = min(i, j)
    print(doubled[start:start + length])


if __name__ == "__main__":
    solve()
