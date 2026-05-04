"""
[PROTOCOL]:

1. 逻辑变更后更新此 Header

2. 更新后检查所属 `.folder.md`

课程：北京大学《数据结构与算法Python版》
来源：https://blog.csdn.net/qq_45347185/article/details/118528594
章节：第六周 递归-下
题目：分发糖果

题意：按相邻评分高者糖果更多、每人至少一个糖果的规则，求最少糖果数。
输入：一个合法 Python 列表表达式，表示评分。
输出：最少糖果总数。
"""


def solve():
    ratings = eval(input())
    candies = [1] * len(ratings)
    for i in range(1, len(ratings)):
        if ratings[i] > ratings[i - 1]:
            candies[i] = candies[i - 1] + 1
    for i in range(len(ratings) - 2, -1, -1):
        if ratings[i] > ratings[i + 1]:
            candies[i] = max(candies[i], candies[i + 1] + 1)
    print(sum(candies))


if __name__ == "__main__":
    solve()
