"""
[PROTOCOL]:

1. 逻辑变更后更新此 Header

2. 更新后检查所属 `.folder.md`

课程：北京大学《数据结构与算法Python版》
来源：https://blog.csdn.net/qq_45347185/article/details/118580048
章节：第十二周 图及算法-下
题目：先修课

题意：给定课程数和先修关系，判断是否存在学完所有课程的顺序。
输入：第一行课程总数；第二行为合法 Python 先修关系嵌套列表。
输出：True 或 False。
"""


def solve():
    n = int(input())
    prerequisites = eval(input())
    graph = [[] for _ in range(n)]
    indegree = [0] * n
    for course, pre in prerequisites:
        graph[pre].append(course)
        indegree[course] += 1
    queue = [i for i in range(n) if indegree[i] == 0]
    learned = 0
    while queue:
        course = queue.pop(0)
        learned += 1
        for next_course in graph[course]:
            indegree[next_course] -= 1
            if indegree[next_course] == 0:
                queue.append(next_course)
    print(learned == n)


if __name__ == "__main__":
    solve()
