#version 460 core
// ---------------------------------------------------------------------------
// Main scene fragment shader (owner: R2)
//
// Texture units used by THIS program (see README, texture unit list):
//   0  sampler2D   theTexture
//   1  sampler2D   directionalShadowMap
//   3..6 samplerCube omniShadowMaps[0..3]
// ---------------------------------------------------------------------------
in vec2 TexCoord;
in vec3 Normal;
in vec3 FragPos;
in vec4 DirectionalLightSpacePos;

layout (location = 0) out vec4 colour;

const int MAX_POINT_LIGHTS = 4;

struct DirectionalLight
{
    vec3  colour;
    float ambientIntensity;
    float diffuseIntensity;
    vec3  direction;           // direction the light TRAVELS
};

struct PointLight
{
    vec3  colour;
    float intensity;           // bulb brightness multiplier
    vec3  position;
    float constant;
    float linear;
    float exponent;
    float farPlane;
};

struct SpotLight
{
    vec3  colour;
    float intensity;
    vec3  position;
    vec3  direction;
    float edge;                // cos(cutoff angle)
    float constant;
    float linear;
    float exponent;
};

uniform DirectionalLight directionalLight;
uniform PointLight       pointLights[MAX_POINT_LIGHTS];
uniform int              pointLightCount;
uniform SpotLight        spotLight;
uniform int              spotOn;

uniform sampler2D   theTexture;
uniform sampler2D   directionalShadowMap;
uniform samplerCube omniShadowMaps[MAX_POINT_LIGHTS];

uniform vec3  eyePosition;
uniform float specularIntensity;
uniform float shininess;
uniform vec3  materialColour;
uniform float emissive;

// ---- gameplay / debug controls -------------------------------------------
uniform int   shadowsEnabled;   // 0 = "break it on purpose": every bulb sees everything
uniform float omniBias;         // WORLD UNITS (compared against distance)
uniform int   debugMode;        // 0 normal, 1 shadow-factor colours, 2 probe read-back

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

// 1 = this fragment can see the bulb, 0 = shadowed (or beyond the bulb's range).
// The CPU test in LitTest.cpp must agree with this function.
float OmniVisible(int i, vec3 lightPos, float farPlane)
{
    vec3  fragToLight = FragPos - lightPos;
    float current     = length(fragToLight);
    if (current > farPlane) return 0.0;
    if (shadowsEnabled == 0) return 1.0;
    // stored depth is distance/farPlane, so multiply back up to world units
    float closest = texture(omniShadowMaps[i], fragToLight).r * farPlane;
    return (current - omniBias > closest) ? 0.0 : 1.0;
}

// returns 1 when in shadow (directional light)
float DirectionalShadow(vec3 N, vec3 L)
{
    vec3 p = DirectionalLightSpacePos.xyz / DirectionalLightSpacePos.w;
    p = p * 0.5 + 0.5;
    if (p.z > 1.0 || p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0) return 0.0;

    // normalised-depth bias: scales with the angle between surface and light
    float bias = max(0.003 * (1.0 - dot(N, L)), 0.0003);
    vec2  texel = 1.0 / vec2(textureSize(directionalShadowMap, 0));
    float shadow = 0.0;
    for (int x = -1; x <= 1; ++x)
        for (int y = -1; y <= 1; ++y)
        {
            float d = texture(directionalShadowMap, p.xy + vec2(x, y) * texel).r;
            shadow += (p.z - bias > d) ? 1.0 : 0.0;
        }
    return shadow / 9.0;
}

float Specular(vec3 N, vec3 L, vec3 V)
{
    if (specularIntensity <= 0.0) return 0.0;
    vec3 R = normalize(reflect(-L, N));
    return specularIntensity * pow(max(dot(V, R), 0.0), shininess);
}

void main()
{
    vec3 N = normalize(Normal);
    vec3 V = normalize(eyePosition - FragPos);
    vec4 base = texture(theTexture, TexCoord) * vec4(materialColour, 1.0);

    // ---- directional "moon" light (ambient + shadowed diffuse/specular) ----
    vec3  Ld = normalize(-directionalLight.direction);
    vec3  total = directionalLight.colour * directionalLight.ambientIntensity;
    float dShadow = (shadowsEnabled != 0) ? DirectionalShadow(N, Ld) : 0.0;
    float dDiff = max(dot(N, Ld), 0.0) * directionalLight.diffuseIntensity;
    float dSpec = (dDiff > 0.0) ? Specular(N, Ld, V) : 0.0;
    total += (1.0 - dShadow) * directionalLight.colour * (dDiff + dSpec);

    // ---- patrolling bulbs: omnidirectional shadows -------------------------
    float illum = 0.0;                         // THE GAMEPLAY NUMBER (no normal term)
    float visArr[MAX_POINT_LIGHTS] = float[MAX_POINT_LIGHTS](0.0, 0.0, 0.0, 0.0);
    float visPacked = 0.0;

    for (int i = 0; i < pointLightCount; ++i)
    {
        PointLight pl = pointLights[i];
        float vis = OmniVisible(i, pl.position, pl.farPlane);
        visArr[i] = vis;
        visPacked += vis * float(1 << i);

        vec3  toLight = pl.position - FragPos;
        float d   = length(toLight);
        vec3  L   = toLight / d;
        float att = pl.exponent * d * d + pl.linear * d + pl.constant;

        illum += vis * dot(pl.colour, LUMA) * pl.intensity / att;

        float diff = max(dot(N, L), 0.0);
        float spec = (diff > 0.0) ? Specular(N, L, V) : 0.0;
        total += vis * pl.colour * pl.intensity * (diff + spec) / att;
    }

    // ---- player's torch (spot light, visible cone with a soft fade) -------
    if (spotOn != 0)
    {
        vec3  toLight = spotLight.position - FragPos;
        float d   = length(toLight);
        vec3  L   = toLight / d;
        float sf  = dot(-L, normalize(spotLight.direction));
        if (sf > spotLight.edge)
        {
            float att  = spotLight.exponent * d * d + spotLight.linear * d + spotLight.constant;
            float fade = 1.0 - (1.0 - sf) * (1.0 / (1.0 - spotLight.edge));
            float diff = max(dot(N, L), 0.0);
            float spec = (diff > 0.0) ? Specular(N, L, V) : 0.0;
            total += fade * fade * spotLight.colour * spotLight.intensity * (diff + spec) / att;
        }
    }

    vec3 result = base.rgb * total + base.rgb * emissive;
    result = result / (1.0 + 0.15 * result);       // gentle tone-map so overlapping bulbs do not clip

    colour = vec4(result, base.a);

    if (debugMode == 1)
    {
        // colour the frame by shadow factor: R,G,B = bulbs 0,1,2 ; bulb 3 adds white
        colour = vec4(vec3(visArr[0], visArr[1], visArr[2]) * 0.8 + visArr[3] * 0.2, 1.0);
    }
    else if (debugMode == 2)
    {
        // probe read-back into a float framebuffer: .r = illumination, .g = packed visibility bits
        colour = vec4(illum, visPacked, 0.0, 1.0);
    }
}
