"""
[PROTOCOL]:

1. 逻辑变更后更新此 Header

2. 更新后检查所属 `.folder.md`

课程：北京大学《数据结构与算法Python版》
来源：https://blog.csdn.net/qq_45347185/article/details/118532103
章节：第八周 排序与查找-下
题目：列表出现最频繁的元素

题意：按出现次数倒序输出前 K 个元素；次数相同按元素值升序。
输入：第一行为合法 Python 列表表达式；第二行为 K。
输出：不多于 K 个数字，以空格分隔。
"""


def solve():
    nums = eval(input())
    k = int(input())
    counts = {}
    for num in nums:
        counts[num] = counts.get(num, 0) + 1
    result = sorted(counts, key=lambda num: (-counts[num], num))[:k]
    print(" ".join(map(str, result)))


if __name__ == "__main__":
    solve()
