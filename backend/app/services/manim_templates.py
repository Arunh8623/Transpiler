"""
Phase 1 (scoped): a small library of hand-verified Manim 3D patterns used
as STYLE REFERENCE injected into the Gemini system prompt for `model_3d`
mode - not executed directly, and not a substitute for the AST validator.
The goal is to bias Gemini's generations toward patterns that are known to
render correctly with ThreeDScene on Windows (correct camera setup calls,
correct axis/surface APIs for this Manim version) rather than leaving the
3D API surface entirely to the model's own (sometimes outdated) memory.

Keyed by topic keyword; `match_templates` does simple keyword matching
against the user's prompt so we only inject 1-2 relevant references
instead of flooding the prompt with all of them.
"""
from __future__ import annotations

TEMPLATES: dict[str, str] = {
    "paraboloid": '''
# Reference pattern: paraboloid + horizontal slicing planes + contour curves
class GeneratedScene(ThreeDScene):
    def construct(self):
        axes = ThreeDAxes(x_range=[-3, 3], y_range=[-3, 3], z_range=[0, 5])
        surface = Surface(
            lambda u, v: axes.c2p(u, v, (u**2 + v**2) / 3),
            u_range=[-2.5, 2.5], v_range=[-2.5, 2.5],
            resolution=(24, 24), fill_opacity=0.6, checkerboard_colors=[BLUE_D, BLUE_E],
        )
        self.set_camera_orientation(phi=65 * DEGREES, theta=-45 * DEGREES, zoom=0.9)
        self.play(Create(axes), Create(surface))
        plane = Surface(
            lambda u, v: axes.c2p(u, v, 1.5),
            u_range=[-2.5, 2.5], v_range=[-2.5, 2.5],
            resolution=(2, 2), fill_opacity=0.25, checkerboard_colors=[GREY, GREY],
        )
        self.play(FadeIn(plane))
        self.begin_ambient_camera_rotation(rate=0.15)
        self.wait(3)
        self.stop_ambient_camera_rotation()
''',
    "saddle": '''
# Reference pattern: saddle surface (hyperbolic paraboloid)
class GeneratedScene(ThreeDScene):
    def construct(self):
        axes = ThreeDAxes()
        surface = Surface(
            lambda u, v: axes.c2p(u, v, (u**2 - v**2) / 3),
            u_range=[-2, 2], v_range=[-2, 2],
            resolution=(24, 24), fill_opacity=0.7, checkerboard_colors=[PURPLE_D, PURPLE_E],
        )
        self.set_camera_orientation(phi=70 * DEGREES, theta=-60 * DEGREES)
        self.play(Create(axes), Create(surface))
        self.wait(2)
''',
    "sphere": '''
# Reference pattern: sphere with orbiting camera and labeled axes
class GeneratedScene(ThreeDScene):
    def construct(self):
        axes = ThreeDAxes()
        sphere = Surface(
            lambda u, v: axes.c2p(
                1.5 * np.cos(u) * np.cos(v), 1.5 * np.cos(u) * np.sin(v), 1.5 * np.sin(u)
            ),
            u_range=[-PI / 2, PI / 2], v_range=[0, TAU],
            resolution=(24, 24), fill_opacity=0.7, checkerboard_colors=[TEAL_D, TEAL_E],
        )
        self.set_camera_orientation(phi=70 * DEGREES, theta=30 * DEGREES)
        self.play(Create(axes), Create(sphere))
        self.begin_ambient_camera_rotation(rate=0.2)
        self.wait(4)
''',
    "cone": '''
# Reference pattern: cone via parametric surface
class GeneratedScene(ThreeDScene):
    def construct(self):
        axes = ThreeDAxes()
        cone = Surface(
            lambda u, v: axes.c2p(u * np.cos(v), u * np.sin(v), 2 - u),
            u_range=[0, 2], v_range=[0, TAU],
            resolution=(16, 24), fill_opacity=0.7, checkerboard_colors=[ORANGE, "#B45309"],
        )
        self.set_camera_orientation(phi=65 * DEGREES, theta=-45 * DEGREES)
        self.play(Create(axes), Create(cone))
        self.wait(2)
''',
    "cylinder": '''
# Reference pattern: cylinder + plane intersection
class GeneratedScene(ThreeDScene):
    def construct(self):
        axes = ThreeDAxes()
        cylinder = Surface(
            lambda u, v: axes.c2p(np.cos(u), np.sin(u), v),
            u_range=[0, TAU], v_range=[-2, 2],
            resolution=(24, 12), fill_opacity=0.6, checkerboard_colors=[GREEN_D, GREEN_E],
        )
        self.set_camera_orientation(phi=70 * DEGREES, theta=-45 * DEGREES)
        self.play(Create(axes), Create(cylinder))
        self.wait(2)
''',
    "vector field": '''
# Reference pattern: 3D vector field
class GeneratedScene(ThreeDScene):
    def construct(self):
        axes = ThreeDAxes()
        self.set_camera_orientation(phi=65 * DEGREES, theta=-45 * DEGREES)
        self.play(Create(axes))
        field = VGroup(*[
            Arrow3D(
                start=axes.c2p(x, y, 0),
                end=axes.c2p(x - y * 0.3, y + x * 0.3, 0),
                color=YELLOW,
            )
            for x in range(-2, 3) for y in range(-2, 3)
        ])
        self.play(Create(field))
        self.wait(2)
''',
    "gradient": '''
# Reference pattern: gradient vectors on a surface (for gradient-field topics)
class GeneratedScene(ThreeDScene):
    def construct(self):
        axes = ThreeDAxes()
        surface = Surface(
            lambda u, v: axes.c2p(u, v, (u**2 + v**2) / 4),
            u_range=[-2, 2], v_range=[-2, 2],
            resolution=(20, 20), fill_opacity=0.5, checkerboard_colors=[BLUE_D, BLUE_E],
        )
        self.set_camera_orientation(phi=65 * DEGREES, theta=-45 * DEGREES)
        self.play(Create(axes), Create(surface))
        grad_arrows = VGroup(*[
            Arrow3D(axes.c2p(x, y, (x**2 + y**2) / 4), axes.c2p(x + x * 0.4, y + y * 0.4, (x**2 + y**2) / 4 + 0.3), color=RED)
            for x in [-1, 0, 1] for y in [-1, 0, 1]
        ])
        self.play(Create(grad_arrows))
        self.wait(2)
''',
    "contour": '''
# Reference pattern: contour curves projected below a surface
class GeneratedScene(ThreeDScene):
    def construct(self):
        axes = ThreeDAxes()
        surface = Surface(
            lambda u, v: axes.c2p(u, v, (u**2 + v**2) / 3),
            u_range=[-2.5, 2.5], v_range=[-2.5, 2.5],
            resolution=(24, 24), fill_opacity=0.5, checkerboard_colors=[BLUE_D, BLUE_E],
        )
        self.set_camera_orientation(phi=65 * DEGREES, theta=-45 * DEGREES)
        self.play(Create(axes), Create(surface))
        for level in [0.5, 1.5, 2.5]:
            contour = ParametricFunction(
                lambda t, level=level: axes.c2p(np.sqrt(level * 3) * np.cos(t), np.sqrt(level * 3) * np.sin(t), 0),
                t_range=[0, TAU], color=YELLOW,
            )
            self.play(Create(contour), run_time=0.8)
        self.wait(1)
''',
}

CAMERA_SNIPPETS: dict[str, str] = {
    "orbit": "self.begin_ambient_camera_rotation(rate=0.2)  # call once, then self.wait(...) for the orbit duration, then self.stop_ambient_camera_rotation()",
    "slow_rotate": "self.begin_ambient_camera_rotation(rate=0.08)",
    "fixed": "# no camera movement - call self.set_camera_orientation(...) once and leave it",
    "top_down": "self.set_camera_orientation(phi=0 * DEGREES, theta=-90 * DEGREES)",
    "custom": "# use self.move_camera(phi=..., theta=..., run_time=...) for a deliberate custom move",
}


def match_templates(prompt: str, max_templates: int = 2) -> list[str]:
    """Keyword-matches the user's prompt against the template library.
    Returns up to `max_templates` raw code snippets to use as style
    reference in the system prompt - never executed, never validated,
    purely a pattern nudge for Gemini's own generation."""
    lowered = prompt.lower()
    matched = [code for key, code in TEMPLATES.items() if key in lowered]
    return matched[:max_templates]


def camera_style_snippet(camera_style: str | None) -> str | None:
    if not camera_style:
        return None
    return CAMERA_SNIPPETS.get(camera_style)
