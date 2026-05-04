"""
[PROTOCOL]:

1. 逻辑变更后更新此 Header

2. 更新后检查所属 `.folder.md`

课程：北京大学《数据结构与算法Python版》
来源：https://blog.csdn.net/qq_45347185/article/details/118532103
章节：第八周 排序与查找-下
题目：散列表

题意：把数字插入不小于 N 的最小质数大小散列表，冲突用正向二次探测。
输入：第一行 N；第二行若干整数。
输出：每个数字的位置；无法插入输出 -。
"""


def is_prime(n):
    if n < 2:
        return False
    for divisor in range(2, int(n**0.5) + 1):
        if n % divisor == 0:
            return False
    return True


def solve():
    size = int(input())
    nums = list(map(int, input().split()))
    while not is_prime(size):
        size += 1
    table = [None] * size
    positions = []
    for num in nums:
        for step in range(size):
            pos = (num + step * step) % size
            if table[pos] in (None, num):
                table[pos] = num
                positions.append(str(pos))
                break
        else:
            positions.append("-")
    print(" ".join(positions))


if __name__ == "__main__":
    solve()
