#version 460 core
// ONE draw call per bulb: the whole cube map is attached to the framebuffer
// (glFramebufferTexture, not ...Texture2D) so gl_Layer selects the face and
// each incoming triangle is fanned out to all six faces here (6x the triangles).
layout (triangles) in;
layout (triangle_strip, max_vertices = 18) out;

uniform mat4 lightMatrices[6];
out vec4 FragPos;

void main()
{
    for (int face = 0; face < 6; ++face)
    {
        gl_Layer = face;
        for (int i = 0; i < 3; ++i)
        {
            FragPos = gl_in[i].gl_Position;
            gl_Position = lightMatrices[face] * FragPos;
            EmitVertex();
        }
        EndPrimitive();
    }
}
