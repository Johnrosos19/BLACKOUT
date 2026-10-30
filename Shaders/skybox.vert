#version 460 core
layout (location = 0) in vec3 pos;
out vec3 TexCoords;
uniform mat4 projection;
uniform mat4 view;
void main()
{
    TexCoords = pos;
    mat4 viewNoTranslation = mat4(mat3(view));
    gl_Position = (projection * viewNoTranslation * vec4(pos, 1.0)).xyww;   // depth = 1.0
}
