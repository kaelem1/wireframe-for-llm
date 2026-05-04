"""
[PROTOCOL]:

1. 逻辑变更后更新此 Header

2. 更新后检查所属 `.folder.md`

课程：北京大学《数据结构与算法Python版》
来源：https://blog.csdn.net/qq_45347185/article/details/118579843
章节：第十一周 图及算法-上
题目：找到小镇的法官

题意：按信任关系判断是否存在唯一小镇法官。
输入：第一行 N；第二行为合法 Python 信任对列表。
输出：法官编号；不存在输出 -1。
"""


def solve():
    n = int(input())
    trust = eval(input())
    score = [0] * (n + 1)
    for a, b in trust:
        score[a] -= 1
        score[b] += 1
    for person in range(1, n + 1):
        if score[person] == n - 1:
            print(person)
            return
    print(-1)


if __name__ == "__main__":
    solve()
