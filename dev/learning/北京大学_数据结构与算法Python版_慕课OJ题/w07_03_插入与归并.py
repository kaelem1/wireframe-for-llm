"""
[PROTOCOL]:

1. 逻辑变更后更新此 Header

2. 更新后检查所属 `.folder.md`

课程：北京大学《数据结构与算法Python版》
来源：https://blog.csdn.net/qq_45347185/article/details/118531686
章节：第七周 排序与查找-上
题目：插入与归并

题意：根据原序列和中间序列判断插入排序或归并排序，并输出再迭代一轮结果。
输入：两行等长整数序列。
输出：排序算法名称；下一轮序列。
"""


def next_insertion(original, current):
    i = 1
    while i < len(current) and current[i - 1] <= current[i]:
        i += 1
    if current[i:] != original[i:]:
        return None
    result = current[:]
    result[: i + 1] = sorted(result[: i + 1])
    return result


def next_merge(original, current):
    size = 1
    result = original[:]
    while result != current:
        size *= 2
        for start in range(0, len(result), size):
            result[start:start + size] = sorted(result[start:start + size])
    size *= 2
    for start in range(0, len(result), size):
        result[start:start + size] = sorted(result[start:start + size])
    return result


def solve():
    original = list(map(int, input().split()))
    current = list(map(int, input().split()))
    inserted = next_insertion(original, current)
    if inserted is not None:
        print("Insertion Sort")
        print(" ".join(map(str, inserted)))
    else:
        print("Merge Sort")
        print(" ".join(map(str, next_merge(original, current))))


if __name__ == "__main__":
    solve()
