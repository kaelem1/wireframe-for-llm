"""
[PROTOCOL]:

1. 逻辑变更后更新此 Header

2. 更新后检查所属 `.folder.md`

课程：北京大学《数据结构与算法Python版》
来源：https://blog.csdn.net/qq_45347185/article/details/118103239
章节：第三周 基本线性结构
题目：强迫症老板和他的洗碗工

题意：判断顾客取盘序列是否可能由按 0 到 9 洗盘并入栈、顾客从栈顶取盘产生。
输入：长度为 10、数字 0 到 9 各出现一次的字符串。
输出：Yes 或 No。
"""


def solve():
    target = input().strip()
    stack = []
    next_plate = 0
    for ch in target:
        plate = int(ch)
        while next_plate <= plate:
            stack.append(next_plate)
            next_plate += 1
        if not stack or stack.pop() != plate:
            print("No")
            return
    print("Yes")


if __name__ == "__main__":
    solve()
