#version 460 core
in vec4 FragPos;
uniform vec3  lightPos;
uniform float farPlane;
void main()
{
    // store LINEAR distance to the bulb, scaled to 0..1
    gl_FragDepth = length(FragPos.xyz - lightPos) / farPlane;
}
