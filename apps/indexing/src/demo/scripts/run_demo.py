"""Run various functions from the demo package to generate graph relationships."""

from demo.foo import foo
from demo.bar import double_foo, triple_foo, Greeter
from demo.package.geometry import area_circle, perimeter_rectangle
from demo.package.algebra import solve_quadratic


def main() -> None:
    print("foo(10) ->", foo(10))
    print("double_foo(10) ->", double_foo(10))
    print("triple_foo(10) ->", triple_foo(10))
    greeter = Greeter("Shadow")
    print(greeter.greet())

    print("Area of circle radius 5 ->", area_circle(5))
    print("Perimeter of rectangle 4x6 ->", perimeter_rectangle(4, 6))

    roots = solve_quadratic(1, 0, -4)
    print("Roots of x^2 - 4 = 0 ->", roots)


if __name__ == "__main__":
    main() 