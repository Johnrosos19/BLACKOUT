#version 460 core
in vec3 TexCoords;
out vec4 colour;
uniform samplerCube skybox;      // texture unit 8
void main()
{
    colour = texture(skybox, TexCoords);
}
