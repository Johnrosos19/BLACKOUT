#version 460 core
// Main scene vertex shader (owner: R2)
layout (location = 0) in vec3 pos;
layout (location = 1) in vec3 norm;
layout (location = 2) in vec2 tex;

out vec2 TexCoord;
out vec3 Normal;
out vec3 FragPos;
out vec4 DirectionalLightSpacePos;

uniform mat4 model;
uniform mat4 view;
uniform mat4 projection;
uniform mat4 directionalLightTransform;

void main()
{
    vec4 world = model * vec4(pos, 1.0);
    gl_Position = projection * view * world;
    DirectionalLightSpacePos = directionalLightTransform * world;
    TexCoord = tex;
    Normal   = mat3(transpose(inverse(model))) * norm;
    FragPos  = world.xyz;
}
