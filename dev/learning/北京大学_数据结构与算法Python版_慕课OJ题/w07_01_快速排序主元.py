"""
[PROTOCOL]:

1. 逻辑变更后更新此 Header

2. 更新后检查所属 `.folder.md`

课程：北京大学《数据结构与算法Python版》
来源：https://blog.csdn.net/qq_45347185/article/details/118531686
章节：第七周 排序与查找-上
题目：快速排序主元

题意：给定划分后的互不相同非负整数排列，找出可能作为快速排序划分主元的元素。
输入：一行整数排列。
输出：第一行主元个数；第二行递增主元列表，或空行。
"""


def solve():
    nums = list(map(int, input().split()))
    suffix_min = [0] * len(nums)
    current = float("inf")
    for i in range(len(nums) - 1, -1, -1):
        suffix_min[i] = current
        current = min(current, nums[i])
    pivots = []
    prefix_max = -1
    for i, num in enumerate(nums):
        if prefix_max < num < suffix_min[i]:
            pivots.append(num)
        prefix_max = max(prefix_max, num)
    pivots.sort()
    print(len(pivots))
    print(" ".join(map(str, pivots)))


if __name__ == "__main__":
    solve()
